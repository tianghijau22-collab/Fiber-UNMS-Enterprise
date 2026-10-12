<?php

namespace App\Services\Olt;

use App\Models\OltDevice;

class OltAlarmSourceResolver
{
    public function __construct(private SnmpTrapEnvelope $envelope) {}

    public function resolve(string $packet, string $sourceIp, string $sourceType): array
    {
        $deny = fn ($reason) => ['accepted' => false, 'reason' => $reason];
        if (!filter_var($sourceIp, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) return $deny('invalid_source');
        $devices = OltDevice::where('status', 'active')->get();
        $direct = $devices->filter(fn ($olt) => $olt->ip_address === $sourceIp);
        $relays = config('olt_events.trusted_relays', []);
        if (!is_array($relays)) return $deny('invalid_source_configuration');
        if ($direct->count() > 1) return $deny('ambiguous_direct_source');
        if ($direct->count() === 1) {
            $candidates = $direct;
        } else {
            $ids = $relays[$sourceIp] ?? [];
            if (!is_array($ids) || !$ids || array_filter($ids, fn ($id) => !is_int($id) || $id < 1)) return $deny('untrusted_source');
            $candidates = $devices->whereIn('id', $ids);
            if ($candidates->isEmpty()) return $deny('untrusted_source');
        }
        $isRelay = $direct->isEmpty();
        if ($sourceType === 'TRAP') {
            $identity = $this->envelope->parse($packet);
            if ($identity === null) return $deny('malformed_or_unsupported_trap');
            $candidates = $candidates->filter(function ($olt) use ($identity) {
                $expected = $olt->getEffectiveCommunity();
                return hash_equals($expected, $identity['community'])
                    || str_starts_with($identity['community'], $expected.'@eventId=');
            });
            if ($candidates->isEmpty()) return $deny('community_mismatch');
            $agent = $identity['agent_ip'];
            if ($agent !== null) {
                $candidates = $candidates->filter(fn ($olt) => $olt->ip_address === $agent);
                if ($candidates->isEmpty()) return $deny('agent_identity_conflict');
            }
            $serial = $identity['serial_number'];
        } elseif ($sourceType === 'SYSLOG') {
            // Shared relays need a verified device identity; no free-text hostname guess.
            if ($isRelay) return $deny('relay_syslog_identity_missing');
            preg_match_all('/(?<![A-Za-z0-9])([A-Za-z]{4}[0-9A-Fa-f]{8})(?![A-Za-z0-9])/', $packet, $matches);
            $serials = array_values(array_unique(array_map('strtoupper', $matches[1])));
            if (count($serials) > 1) return $deny('conflicting_serials');
            $serial = $serials[0] ?? null;
            $agent = null;
        } else {
            return $deny('unsupported_source_type');
        }
        if ($serial !== null) {
            $holders = $devices->filter(fn ($olt) => $this->hasSerial($olt, $serial));
            if ($holders->isEmpty()) return $deny('serial_not_in_inventory');
            if ($holders->count() !== 1) return $deny('ambiguous_serial_inventory');
            $candidates = $candidates->where('id', $holders->first()->id);
            if ($candidates->isEmpty()) return $deny('serial_identity_conflict');
        } elseif ($isRelay && $agent === null) {
            return $deny('relay_device_identity_missing');
        }
        if ($candidates->count() !== 1) return $deny('ambiguous_device');
        return ['accepted' => true, 'reason' => $isRelay ? 'trusted_relay_identity' : 'direct_device', 'olt' => $candidates->first(), 'serial_number' => $serial];
    }

    private function hasSerial(OltDevice $olt, string $serial): bool
    {
        $snapshot = $olt->last_telemetry_snapshot ?? [];
        foreach (array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []) as $onu) {
            if (!is_array($onu)) continue;
            foreach (['serial_number', 'onu_mac'] as $field) {
                if (strcasecmp(trim((string) ($onu[$field] ?? '')), $serial) === 0) return true;
            }
        }
        return false;
    }
}
