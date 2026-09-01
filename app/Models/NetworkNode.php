<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class NetworkNode extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'node_type',
        'device_type_id',
        'brand_id',
        'model',
        'serial_number',
        'status',
        'latitude',
        'longitude',
        'address',
        'province_id',
        'regency_id',
        'district_id',
        'village_id',
        'parent_node_id',
        'olt_device_id',
        'splitter_type_id',
        'splitter_cascade_level',
        'olt_port_ref',
        'total_ports',
        'used_ports',
        'installed_at',
        'notes',
        'core_power',
        'core_color',
        'splitter_config',
        'tube_count',
        'tube_info',
        'splitter_count',
        'odc_topology_type',
        'created_by',
    ];

    protected $casts = [
        'latitude'               => 'decimal:7',
        'longitude'              => 'decimal:7',
        'installed_at'           => 'date',
        'total_ports'            => 'integer',
        'used_ports'             => 'integer',
        'splitter_cascade_level' => 'integer',
        'splitter_config'        => 'array',
    ];

    // ─── Relationships ──────────────────────────────────────────────────────────

    public function oltDevice()
    {
        return $this->belongsTo(OltDevice::class, 'olt_device_id');
    }

    public function deviceType()
    {
        return $this->belongsTo(DeviceType::class);
    }

    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    public function province()
    {
        return $this->belongsTo(Province::class);
    }

    public function regency()
    {
        return $this->belongsTo(Regency::class);
    }

    public function district()
    {
        return $this->belongsTo(District::class);
    }

    public function village()
    {
        return $this->belongsTo(Village::class);
    }

    /** Node induk (misal: ODC induk ODP ini) */
    public function parent()
    {
        return $this->belongsTo(NetworkNode::class, 'parent_node_id');
    }

    /** Node-node anak di bawah node ini */
    public function children()
    {
        return $this->hasMany(NetworkNode::class, 'parent_node_id');
    }

    public function ports()
    {
        return $this->hasMany(NetworkPort::class, 'node_id');
    }

    public function splitters()
    {
        return $this->hasMany(NetworkSplitter::class, 'node_id');
    }

    /** Tipe splitter pasif yang terpasang di node ini (PLC 1:2, 1:4, 1:8, dll) */
    public function splitterType()
    {
        return $this->belongsTo(\App\Models\SplitterType::class, 'splitter_type_id');
    }

    /** Kabel yang berangkat dari node ini */
    public function cablesFrom()
    {
        return $this->hasMany(NetworkCable::class, 'from_node_id');
    }

    /** Kabel yang menuju node ini */
    public function cablesTo()
    {
        return $this->hasMany(NetworkCable::class, 'to_node_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    public function availablePorts(): int
    {
        return $this->total_ports - $this->used_ports;
    }

    public function isOlt(): bool
    {
        return $this->node_type === 'OLT';
    }

    /**
     * Cache telemetri live ONU OLT selama request lifecycle
     */
    protected static ?array $_liveOnuTelemetryMap = null;

    public static function getLiveOnuTelemetryMap(): array
    {
        if (self::$_liveOnuTelemetryMap !== null) {
            return self::$_liveOnuTelemetryMap;
        }

        $map = [];
        $oltDevices = \App\Models\OltDevice::whereNotNull('last_telemetry_snapshot')->get();
        foreach ($oltDevices as $dev) {
            $snapOnus = array_merge(
                $dev->last_telemetry_snapshot['onu_list'] ?? [],
                $dev->last_telemetry_snapshot['unconfigured_onus'] ?? []
            );
            foreach ($snapOnus as $so) {
                $snKey = strtolower(trim($so['serial_number'] ?? ''));
                $macKey = strtolower(trim($so['mac_address'] ?? ($so['onu_mac'] ?? '')));
                $so['_olt_id'] = $dev->id;
                $so['_olt_name'] = $dev->name;
                if ($snKey) $map[$snKey] = $so;
                if ($macKey) $map[$macKey] = $so;
            }
        }

        return self::$_liveOnuTelemetryMap = $map;
    }

    /**
     * Deteksi otomatis Interface PON dan Perangkat OLT dari pelanggan/modem yang terkoneksi
     */
    public function getAutoDetectedInterfaceAndOlt(): array
    {
        $liveMap = self::getLiveOnuTelemetryMap();
        $detectedPorts = [];
        $detectedOlt = null;

        if ($this->node_type === 'ODP') {
            $custServices = \Illuminate\Support\Facades\DB::table('network_ports')
                ->join('customer_services', 'customer_services.id', '=', 'network_ports.customer_service_id')
                ->leftJoin('ont_registrations', 'ont_registrations.customer_service_id', '=', 'customer_services.id')
                ->where('network_ports.node_id', $this->id)
                ->select('ont_registrations.onu_serial', 'ont_registrations.onu_mac', 'customer_services.onu_serial as svc_serial')
                ->get();

            foreach ($custServices as $cs) {
                $sn = strtolower(trim($cs->onu_serial ?: $cs->svc_serial ?: ''));
                $mac = strtolower(trim($cs->onu_mac ?: ''));
                $live = ($sn && isset($liveMap[$sn])) ? $liveMap[$sn] : (($mac && isset($liveMap[$mac])) ? $liveMap[$mac] : null);
                if ($live) {
                    $p = $live['port'] ?? ($live['detected_port'] ?? ($live['interface'] ?? null));
                    if ($p && $p !== 'none' && $p !== '—') {
                        $detectedPorts[] = $p;
                        if (!$detectedOlt) {
                            $detectedOlt = [
                                'id'   => $live['_olt_id'] ?? null,
                                'name' => $live['_olt_name'] ?? null,
                            ];
                        }
                    }
                }
            }

            // Fallback inherit dari parent ODC jika ODP belum memiliki pelanggan aktif
            if (empty($detectedPorts) && $this->parent) {
                if ($this->parent->olt_port_ref) {
                    $detectedPorts[] = $this->parent->olt_port_ref;
                }
                if ($this->parent->oltDevice && !$detectedOlt) {
                    $detectedOlt = [
                        'id'   => $this->parent->oltDevice->id,
                        'name' => $this->parent->oltDevice->name,
                    ];
                }
            }
        } elseif ($this->node_type === 'ODC') {
            $childIds = \Illuminate\Support\Facades\DB::table('network_nodes')
                ->where('parent_node_id', $this->id)
                ->whereNull('deleted_at')
                ->pluck('id')
                ->toArray();

            if (!empty($childIds)) {
                $custServices = \Illuminate\Support\Facades\DB::table('network_ports')
                    ->join('customer_services', 'customer_services.id', '=', 'network_ports.customer_service_id')
                    ->leftJoin('ont_registrations', 'ont_registrations.customer_service_id', '=', 'customer_services.id')
                    ->whereIn('network_ports.node_id', $childIds)
                    ->select('ont_registrations.onu_serial', 'ont_registrations.onu_mac', 'customer_services.onu_serial as svc_serial')
                    ->get();

                foreach ($custServices as $cs) {
                    $sn = strtolower(trim($cs->onu_serial ?: $cs->svc_serial ?: ''));
                    $mac = strtolower(trim($cs->onu_mac ?: ''));
                    $live = ($sn && isset($liveMap[$sn])) ? $liveMap[$sn] : (($mac && isset($liveMap[$mac])) ? $liveMap[$mac] : null);
                    if ($live) {
                        $p = $live['port'] ?? ($live['detected_port'] ?? ($live['interface'] ?? null));
                        if ($p && $p !== 'none' && $p !== '—') {
                            $detectedPorts[] = $p;
                            if (!$detectedOlt) {
                                $detectedOlt = [
                                    'id'   => $live['_olt_id'] ?? null,
                                    'name' => $live['_olt_name'] ?? null,
                                ];
                            }
                        }
                    }
                }
            }
        }

        $uniquePorts = array_values(array_unique(array_filter($detectedPorts)));
        $portRef = !empty($uniquePorts) ? implode(', ', $uniquePorts) : null;

        return [
            'port_ref'   => $portRef,
            'olt_device' => $detectedOlt,
        ];
    }
}
