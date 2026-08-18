<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Crypt;

class OltDevice extends Model
{
    protected $table = 'olt_devices';

    protected $fillable = [
        'name', 'code', 'vendor', 'model', 'vendor_key', 'location',
        'ip_address', 'total_ports', 'deployment_mode',
        'snmp_version', 'snmp_community_type', 'snmp_community_string',
        'snmp_v3_username', 'snmp_v3_auth_protocol', 'snmp_v3_auth_password',
        'snmp_v3_priv_protocol', 'snmp_v3_priv_password',
        'snmp_port', 'snmp_timeout', 'snmp_retries',
        'cli_protocol', 'cli_username', 'cli_password', 'cli_port',
        'probe_agent_url', 'probe_agent_token',
        'status', 'connection_mode', 'last_connected_at',
        'last_ping_ms', 'last_telemetry_snapshot',
    ];

    protected $hidden = [
        'snmp_community_string', 'snmp_v3_auth_password',
        'snmp_v3_priv_password', 'cli_password', 'probe_agent_token',
    ];

    protected $casts = [
        'last_telemetry_snapshot' => 'array',
        'last_connected_at' => 'datetime',
    ];

    /**
     * Get the effective SNMP community string (decrypted if needed).
     */
    public function getEffectiveCommunity(): string
    {
        if ($this->snmp_community_type === 'public') {
            return 'public';
        }
        if ($this->snmp_community_string) {
            try {
                return Crypt::decryptString($this->snmp_community_string);
            } catch (\Exception $e) {
                return $this->snmp_community_string; // fallback if not encrypted
            }
        }
        return 'public';
    }

    /**
     * Get decrypted CLI password.
     */
    public function getCliPasswordDecrypted(): ?string
    {
        if (!$this->cli_password) return null;
        try {
            return Crypt::decryptString($this->cli_password);
        } catch (\Exception $e) {
            return $this->cli_password;
        }
    }

    /**
     * Set SNMP community string (encrypt on store).
     */
    public function setSnmpCommunityStringAttribute($value): void
    {
        $this->attributes['snmp_community_string'] = $value ? Crypt::encryptString($value) : null;
    }

    /**
     * Set CLI password (encrypt on store).
     */
    public function setCliPasswordAttribute($value): void
    {
        $this->attributes['cli_password'] = $value ? Crypt::encryptString($value) : null;
    }
}
