<?php

namespace App\Services\Olt;

use App\Models\NetworkNode;
use App\Models\OltDevice;

/** A request-local read model. It never queries an OLT or writes customer state. */
class OnuTelemetryView
{
    public const MAX_SAMPLE_AGE = 180;
    private array $devices = [];
    private array $rows = [];

    public function __construct(iterable $devices)
    {
        foreach ($devices as $device) {
            $id = (int)$device->id;
            $snapshot = $device->getAttribute('last_telemetry_snapshot') ?? [];
            $isZte = str_contains(strtolower((string)($device->vendor_key ?: $device->vendor)), 'zte');
            $this->devices[$id] = ['name'=>$device->name, 'sampled_at'=>$snapshot['polled_at'] ?? null, 'is_zte'=>$isZte];
            $rows = array_merge($snapshot['onu_list'] ?? [], $snapshot['unconfigured_onus'] ?? []);
            if ($isZte) {
                $rows = array_values(ZteOnuIdentityMap::uniqueRows($rows));
            } else {
                $rows = array_filter($rows, fn($r) => ($r['_source'] ?? '') === 'live_snmp');
            }
            $candidates = [];
            foreach ($rows as $row) {
                foreach ([$row['serial_number'] ?? '', $row['mac_address'] ?? $row['onu_mac'] ?? ''] as $key) {
                    $key = strtoupper(trim((string)$key));
                    if ($key !== '') $candidates[$key][] = $row;
                }
            }
            foreach ($candidates as $key => $matches) {
                $locations = array_unique(array_map(fn($r) => ($r['port'] ?? '').':'.($r['onu_id'] ?? ''), $matches));
                if (count($locations) === 1) $this->rows[$id][$key] = $matches[0];
            }
        }
    }

    public static function load(): self
    {
        return new self(OltDevice::where('status', 'active')->where('connection_mode', 'live')->get());
    }

    public static function forRequest(): self
    {
        if (app()->runningInConsole()) return self::load();
        $request = request();
        $view = $request->attributes->get(self::class);
        if (!$view instanceof self) {
            $view = self::load();
            $request->attributes->set(self::class, $view);
        }
        return $view;
    }

    public static function ownerId(?NetworkNode $node): ?int
    {
        $seen = [];
        for ($depth = 0; $node && $depth < 8; $depth++, $node = $node->parent) {
            if ($node->olt_device_id) return (int)$node->olt_device_id;
            if (isset($seen[$node->id])) break;
            $seen[$node->id] = true;
        }
        return null;
    }

    public function forNode(?NetworkNode $node, ?string $serial, ?string $mac = null): array
    {
        return $this->resolve(self::ownerId($node), $serial, $mac);
    }

    public function resolve(?int $oltId, ?string $serial, ?string $mac = null): array
    {
        $device = $oltId ? ($this->devices[$oltId] ?? null) : null;
        $view = [
            'telemetry_contract' => 1, 'olt_id' => $oltId, 'olt_name' => $device['name'] ?? null,
            'gpon_interface' => null, 'onu_id' => null, 'identity_status' => 'unresolved',
            'is_online' => null, 'onu_status' => 'Unknown', 'rx_power' => null,
            'rx_available' => false, 'telemetry_source' => null, 'sampled_at' => null,
            'sample_age_seconds' => null, 'telemetry_freshness' => 'unavailable',
            'telemetry_reason' => $oltId ? 'identity_unresolved' : 'olt_unmapped',
        ];
        if (!$device) return $view;
        $keys = array_values(array_unique(array_filter(array_map(fn($s) => strtoupper(trim((string)$s)), [$serial, $mac]))));
        $matches = [];
        foreach ($keys as $key) if (isset($this->rows[$oltId][$key])) $matches[] = $this->rows[$oltId][$key];
        if (!$matches) return $view;
        $locations = array_unique(array_map(fn($r) => ($r['port'] ?? '').':'.($r['onu_id'] ?? ''), $matches));
        if (count($locations) !== 1) return array_replace($view, ['telemetry_reason' => 'identity_conflict']);
        $row = $matches[0];
        $isZte = $device['is_zte'];
        if ($isZte && !self::ageIsValid($row['identity_observed_at'] ?? null, 600)) {
            $at = is_string($row['identity_observed_at'] ?? null) ? strtotime($row['identity_observed_at']) : false;
            return $at !== false && $at < time() - 600 ? array_replace($view, [
                'telemetry_reason'=>'identity_stale', 'telemetry_freshness'=>'stale', 'sampled_at'=>$row['sample_observed_at'] ?? null,
            ]) : $view;
        }
        $view = array_replace($view, [
            'gpon_interface' => $row['port'] ?? null, 'onu_id' => $row['onu_id'] ?? null,
            'identity_status' => 'resolved', 'telemetry_source' => 'snapshot',
            'sampled_at' => ($row['telemetry_sample_version'] ?? null) === 2 ? ($row['sample_observed_at'] ?? null) : ($isZte ? null:$device['sampled_at']),
        ]);
        $time = is_string($view['sampled_at']) ? strtotime($view['sampled_at']) : false;
        $view['sample_age_seconds'] = $time === false ? null : max(0, time() - $time);
        if ($time === false) return array_replace($view,['telemetry_freshness'=>'unavailable','telemetry_reason'=>'sample_unavailable']);
        if (!self::ageIsValid($view['sampled_at'], self::MAX_SAMPLE_AGE)) {
            return array_replace($view, ['telemetry_freshness' => 'stale', 'telemetry_reason' => 'sample_stale']);
        }
        return array_replace($view, self::state($row), ['telemetry_freshness' => 'fresh']);
    }

    /** Point readings must refer to the already selected OLT/PON/ONU, never to an ODP uplink. */
    public static function withPoint(array $view, array $reading, string $sampledAt): array
    {
        $currentAt=OnuTelemetrySample::epoch($view['sampled_at'] ?? null);
        $pointAt=OnuTelemetrySample::epoch($sampledAt);
        if($pointAt===null || ($currentAt!==null && $pointAt<$currentAt))return $view;
        $expectedIndex = ZteOnuIdentityMap::ifIndexFromPort((string)$view['gpon_interface']);
        $actualIndex = ZteOnuIdentityMap::ifIndexFromPort((string)($reading['port'] ?? ''));
        if ($view['identity_status'] !== 'resolved' || ($reading['identity_verified'] ?? false) !== true
            || (string)$view['onu_id'] !== (string)($reading['onu_id'] ?? '')
            || $expectedIndex === null || $expectedIndex !== $actualIndex
            || !self::ageIsValid($sampledAt, self::MAX_SAMPLE_AGE)) return $view;
        return array_replace($view, self::state($reading), [
            'telemetry_source' => 'snmp_point', 'sampled_at' => $sampledAt,
            'sample_age_seconds' => 0, 'telemetry_freshness' => 'fresh',
        ]);
    }

    private static function ageIsValid(mixed $value, int $limit): bool
    {
        $time = is_string($value) ? strtotime($value) : false;
        return $time !== false && $time <= time() + 5 && $time >= time() - $limit;
    }

    private static function state(array $row): array
    {
        if(($row['telemetry_sample_version'] ?? null)===2) {
            $sample=OnuTelemetrySample::project($row);
            if(!self::ageIsValid($sample['state_observed_at'],self::MAX_SAMPLE_AGE)) {
                $sample['is_online']=null;$sample['status']='Unknown';
            }
            if(!self::ageIsValid($sample['rx_observed_at'],self::MAX_SAMPLE_AGE)) {
                $sample['rx_power']=null;$sample['rx_available']=false;
            }
            $row=array_replace($row,$sample);
        }
        $state = strtolower(trim((string)($row['status'] ?? '')));
        $online = array_key_exists('is_online', $row) && is_bool($row['is_online']) ? $row['is_online']
            : (in_array($state, ['online', 'active', 'working'], true) ? true
            : (in_array($state, ['offline', 'inactive', 'los', 'down', 'poweroff'], true) ? false : null));
        $rx = isset($row['rx_power']) && is_numeric($row['rx_power']) ? (float)$row['rx_power'] : null;
        // Old zero placeholders have no measurement validity flag. Offline sentinels are never measurements.
        if ($online !== true || $rx === null || !is_finite($rx) || $rx <= -40 || $rx > 10
            || (array_key_exists('rx_available', $row) && $row['rx_available'] !== true)
            || ($rx === 0.0 && ($row['rx_available'] ?? false) !== true)) $rx = null;
        return [
            'is_online' => $online, 'onu_status' => $online === true ? 'Online' : ($online === false ? 'Offline' : 'Unknown'),
            'rx_power' => $rx, 'rx_available' => $rx !== null,
            'telemetry_reason' => $online === null ? 'state_unavailable' : ($online && $rx === null ? 'rx_unavailable' : null),
        ];
    }

    public static function summarize(array $views, int $expectedTotal = 0): array
    {
        $total = max(count($views), $expectedTotal);
        $online = count(array_filter($views, fn($v) => $v['is_online'] === true));
        $down = count(array_filter($views, fn($v) => $v['is_online'] === false));
        $unknown = $total - $online - $down;
        $powers = array_values(array_map(fn($v) => $v['rx_power'], array_filter($views, fn($v) => $v['is_online'] === true && $v['rx_available'])));
        $best = $powers ? max($powers) : null; $worst = $powers ? min($powers) : null;
        $totalLoss = $total > 0 && $down === $total && $unknown === 0;
        $range = !$total ? 'Belum ada pelanggan' : ($totalLoss ? 'Semua pelanggan Offline' : (!$powers ? 'N/A' : ($best === $worst ? "$best dBm" : "$best s/d $worst dBm")));
        if ($down && !$totalLoss) $range .= ' (Ada pelanggan Offline)';
        if ($unknown) $range .= " ($unknown belum terverifikasi)";
        $signal = !$total ? 'no_customer' : ($totalLoss ? 'critical' : ($unknown || (!$powers && !$down) ? 'unknown' : ($down || $worst < -28 ? 'critical' : ($worst < -25 ? 'warning' : 'good'))));
        return [
            'powers' => $powers, 'total' => $total, 'has_loss' => $down > 0,
            'online_clients' => $online, 'loss_clients' => $down, 'unknown_clients' => $unknown,
            'is_loss_total' => $totalLoss, 'best_rx_power' => $best, 'worst_rx_power' => $worst,
            'rx_power_range' => $range, 'signal_status' => $signal,
            'avg_rx_power' => $powers ? round(array_sum($powers) / count($powers), 2) : null,
        ];
    }

    public static function occupiedPortCount(iterable $ports): int
    {
        $count = 0;
        foreach ($ports as $port) {
            if (data_get($port, 'customer_service_id') || data_get($port, 'status') === 'used' || data_get($port, 'customer_name_cache')) $count++;
        }
        return $count;
    }
}
