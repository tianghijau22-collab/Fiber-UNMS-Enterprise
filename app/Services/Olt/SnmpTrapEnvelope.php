<?php

namespace App\Services\Olt;

/** Bounded BER reader for source identity; not a vendor alarm classifier. */
class SnmpTrapEnvelope
{
    public function parse(string $packet): ?array
    {
        if (strlen($packet) > 4096 || strlen($packet) < 8) return null;
        try {
            $offset = 0;
            [$tag, $body] = $this->read($packet, $offset);
            if ($tag !== 0x30 || $offset !== strlen($packet)) return null;
            $message = $this->children($body);
            if (count($message) !== 3 || $message[1][0] !== 0x04 || $message[1][1] === '') return null;
            $version = $this->integer($message[0]);
            [$pduTag, $pdu] = $message[2];
            $fields = $this->children($pdu);
            $agent = null;
            if ($version === 0 && $pduTag === 0xa4 && count($fields) === 6) {
                if ($fields[0][0] !== 0x06 || $fields[1][0] !== 0x40 || strlen($fields[1][1]) !== 4) return null;
                $this->oid($fields[0][1]);
                $generic = $this->integer($fields[2]);
                if ($generic < 0 || $generic > 6 || $this->integer($fields[3]) < 0 || $fields[4][0] !== 0x43 || $fields[4][1] === '' || strlen($fields[4][1]) > 5) return null;
                $agent = inet_ntop($fields[1][1]);
                $bindings = $fields[5];
            } elseif ($version === 1 && $pduTag === 0xa7 && count($fields) === 4) {
                $this->integer($fields[0]);
                if ($this->integer($fields[1]) !== 0 || $this->integer($fields[2]) !== 0) return null;
                $bindings = $fields[3];
            } else {
                return null;
            }
            if ($bindings[0] !== 0x30) return null;
            $addresses = []; $serials = []; $oids = []; $trapOid = null;
            foreach ($this->children($bindings[1]) as [$pairTag, $pair]) {
                $values = $this->children($pair);
                if ($pairTag !== 0x30 || count($values) !== 2 || $values[0][0] !== 0x06) return null;
                $oid = $this->oid($values[0][1]);
                if (isset($oids[$oid])) return null;
                $oids[$oid] = true;
                [$valueTag, $value] = $values[1];
                if ($oid === '1.3.6.1.6.3.18.1.3.0') {
                    if ($valueTag !== 0x40 || strlen($value) !== 4) return null;
                    $addresses[] = inet_ntop($value);
                }
                if ($oid === '1.3.6.1.6.3.1.1.4.1.0') {
                    if ($valueTag !== 0x06) return null;
                    $trapOid = $this->oid($value);
                }
                if ($oid === '1.3.6.1.2.1.1.3.0' && ($valueTag !== 0x43 || $value === '' || strlen($value) > 5)) return null;
                if ($valueTag === 0x04) {
                    preg_match_all('/(?<![A-Za-z0-9])([A-Za-z]{4}[0-9A-Fa-f]{8})(?![A-Za-z0-9])/', $value, $matches);
                    foreach ($matches[1] as $serial) $serials[strtoupper($serial)] = true;
                }
            }
            if ($version === 1 && ($trapOid === null || !isset($oids['1.3.6.1.2.1.1.3.0']))) return null;
            if ($agent !== null && $agent !== '0.0.0.0') $addresses[] = $agent;
            $addresses = array_values(array_unique(array_filter($addresses, fn ($ip) => $ip !== '0.0.0.0')));
            if (count($addresses) > 1 || count($serials) > 1) return null;

            return [
                'version' => $version === 0 ? 'v1' : 'v2c',
                'community' => $message[1][1], // Internal only; never include in logs/cache decisions.
                'agent_ip' => $addresses[0] ?? null,
                'serial_number' => array_key_first($serials),
                'trap_oid' => $trapOid,
            ];
        } catch (\UnexpectedValueException) {
            return null;
        }
    }

    private function read(string $data, int &$offset): array
    {
        $size = strlen($data);
        if ($offset + 2 > $size) throw new \UnexpectedValueException('Truncated BER');
        $tag = ord($data[$offset++]);
        if (($tag & 0x1f) === 0x1f) throw new \UnexpectedValueException('Unsupported BER tag');
        $length = ord($data[$offset++]);
        if ($length & 0x80) {
            $count = $length & 0x7f;
            if ($count === 0 || $count > 4 || $offset + $count > $size) throw new \UnexpectedValueException('Invalid BER length');
            $length = 0;
            for ($i = 0; $i < $count; $i++) $length = ($length << 8) | ord($data[$offset++]);
        }
        if ($length > $size - $offset) throw new \UnexpectedValueException('Truncated BER value');
        $value = substr($data, $offset, $length); $offset += $length;
        return [$tag, $value];
    }

    private function children(string $data): array
    {
        $offset = 0; $children = [];
        while ($offset < strlen($data)) {
            if (count($children) >= 128) throw new \UnexpectedValueException('BER node limit');
            $children[] = $this->read($data, $offset);
        }
        return $children;
    }

    private function integer(array $field): int
    {
        [$tag, $bytes] = $field;
        if ($tag !== 0x02 || $bytes === '' || strlen($bytes) > 4) throw new \UnexpectedValueException('Invalid integer');
        $value = (ord($bytes[0]) & 0x80) ? -1 : 0;
        foreach (str_split($bytes) as $byte) $value = ($value << 8) | ord($byte);
        return $value;
    }

    private function oid(string $bytes): string
    {
        $arcs = []; $value = 0; $pending = false;
        foreach (str_split($bytes) as $byte) {
            $b = ord($byte); $value = ($value << 7) | ($b & 0x7f); $pending = (bool) ($b & 0x80);
            if ($value > 0xffffffff) throw new \UnexpectedValueException('OID arc limit');
            if (!$pending) { $arcs[] = $value; $value = 0; }
        }
        if ($pending || !$arcs) throw new \UnexpectedValueException('Invalid OID');
        $first = array_shift($arcs); $head = min(intdiv($first, 40), 2);
        return implode('.', [$head, $first - $head * 40, ...$arcs]);
    }
}
