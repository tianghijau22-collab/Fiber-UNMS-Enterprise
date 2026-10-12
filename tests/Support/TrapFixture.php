<?php

namespace Tests\Support;

final class TrapFixture
{
    public static function tlv(int $tag, string $value): string
    {
        $length = strlen($value);
        $encoded = $length < 128 ? chr($length) : "\x82".pack('n', $length);
        return chr($tag).$encoded.$value;
    }

    public static function oid(string $oid): string
    {
        $arcs = array_map('intval', explode('.', $oid));
        $first = array_shift($arcs) * 40 + array_shift($arcs);
        $bytes = '';
        foreach ([$first, ...$arcs] as $arc) {
            $part = chr($arc & 127);
            while ($arc >>= 7) $part = chr(($arc & 127) | 128).$part;
            $bytes .= $part;
        }
        return self::tlv(6, $bytes);
    }

    public static function binding(string $oid, int $tag, string $value): string
    {
        return self::tlv(48, self::oid($oid).self::tlv($tag, $value));
    }

    public static function v2(?string $serial = null, ?string $agent = null, string $community = 'fixture-community', array $extra = []): string
    {
        $bindings = self::binding('1.3.6.1.2.1.1.3.0', 67, "\x01")
            .self::tlv(48, self::oid('1.3.6.1.6.3.1.1.4.1.0').self::oid('1.3.6.1.4.1.3902.1082.500.10.3.1.2'));
        if ($serial !== null) $bindings .= self::binding('1.3.6.1.4.1.3902.1', 4, $serial);
        if ($agent !== null) $bindings .= self::binding('1.3.6.1.6.3.18.1.3.0', 64, inet_pton($agent));
        $pdu = self::tlv(2, "\x01").self::tlv(2, "\x00").self::tlv(2, "\x00").self::tlv(48, $bindings.implode('', $extra));
        return self::tlv(48, self::tlv(2, "\x01").self::tlv(4, $community).self::tlv(167, $pdu));
    }

    public static function v1(string $agent): string
    {
        $pdu = self::oid('1.3.6.1.4.1.3902').self::tlv(64, inet_pton($agent))
            .self::tlv(2, "\x06").self::tlv(2, "\x01").self::tlv(67, "\x01").self::tlv(48, '');
        return self::tlv(48, self::tlv(2, "\x00").self::tlv(4, 'fixture-community').self::tlv(164, $pdu));
    }
}
