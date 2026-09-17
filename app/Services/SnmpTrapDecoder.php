<?php

namespace App\Services;

class SnmpTrapDecoder
{
    /**
     * Parse raw UDP payload from SNMP Trap (port 162) or Syslog (port 514).
     *
     * @param string $rawPayload
     * @param string $fromIp
     * @return array|null Returns parsed event array or null if unrecognized or non-ONU system trap
     */
    public static function decode(string $rawPayload, string $fromIp = ''): ?array
    {
        $cleanString = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', ' ', $rawPayload);

        // 1. Ekstrak Serial Number (GPON SN format: 4 uppercase letters vendor code + 8 hex chars, misal ZTEGD5D351F7)
        $serialNumber = null;
        if (preg_match('/(?:[0-9]+,)?([A-Za-z]{4}[0-9A-Fa-f]{8})/i', $cleanString, $snMatch)) {
            $serialNumber = strtoupper(trim($snMatch[1]));
        } elseif (preg_match('/(?:sn|serial|serialnumber)\s*[:=]\s*([A-Za-z0-9]{12,16})/i', $cleanString, $snMatch)) {
            $serialNumber = strtoupper(trim($snMatch[1]));
        }

        // 2. Ekstrak Event Level & Tipe Alarm dari ZTE Community / Event Header
        // Contoh ZTE: C="public@eventId=943342@eventLevel=cleared@confirm@20030216080825"
        $eventLevel = null;
        if (preg_match('/eventLevel=([a-zA-Z0-9_-]+)/i', $cleanString, $levelMatch)) {
            $eventLevel = strtolower(trim($levelMatch[1]));
        }

        // 3. Ekstrak Port & ONU ID
        $portRef = null;
        $onuId = null;
        $rawOnuDesc = null;

        if (preg_match('/(?:ONU-|ONU\s+|onu_)([0-9\/\:\_\-]+)/i', $cleanString, $onuMatch)) {
            $rawOnuDesc = trim($onuMatch[1]);
            if (strpos($rawOnuDesc, ':') !== false) {
                [$p, $o] = explode(':', $rawOnuDesc, 2);
                $portRef = trim($p);
                $onuId = (int)$o;
            } else {
                $portRef = trim($rawOnuDesc);
            }
        } elseif (preg_match('/(?:gpon-olt_|epon-olt_|gpon_|epon_)([0-9]+\/[0-9]+\/[0-9]+)/i', $cleanString, $pMatch)) {
            $portRef = 'gpon-olt_' . trim($pMatch[1]);
        } elseif (preg_match('/(?:port|interface)\s+([0-9]+\/[0-9]+\/[0-9]+)/i', $cleanString, $pMatch)) {
            $portRef = 'gpon-olt_' . trim($pMatch[1]);
        } elseif (preg_match('/(?:slot|subrack)\s*[0-9]+\s*(?:slot|port)\s*([0-9]+\/[0-9]+\/[0-9]+)/i', $cleanString, $pMatch)) {
            $portRef = 'gpon-olt_' . trim($pMatch[1]);
        }

        // Filter: Hanya loloskan jika ada Serial Number, deskripsi ONU, atau Port Ref
        if (!$serialNumber && !$rawOnuDesc && !$portRef) {
            return null;
        }

        // Cek apakah ini event level port/interface fisik (SFP Dicabut / Link Down / Link Up)
        $isPortEvent = (!$onuId && $portRef && !$serialNumber);

        // 4. Deteksi Klasifikasi Alarm (LOS, Dying Gasp, Recovery, Port Down, dsb)
        $eventType = null;
        $eventLabel = '';
        $isLoss = false;

        // Cek apakah payload mengandung sinyal Link Down / Link Up standar SNMP atau ZTE
        $hasLinkDownSignal = str_contains($rawPayload, "\x2b\x06\x01\x06\x03\x01\x01\x05\x03") 
            || str_contains($cleanString, '1.3.6.1.6.3.1.1.5.3')
            || (bool)preg_match('/(pull[- ]?out|unplugged|linkDown|link_down|port_down|lossOfSignal)/i', $cleanString);

        $hasLinkUpSignal = str_contains($rawPayload, "\x2b\x06\x01\x06\x03\x01\x01\x05\x04") 
            || str_contains($cleanString, '1.3.6.1.6.3.1.1.5.4')
            || (bool)preg_match('/(plug[- ]?in|inserted|linkUp|link_up|port_up)/i', $cleanString);

        if ($isPortEvent || (!$onuId && ($hasLinkDownSignal || $hasLinkUpSignal))) {
            if ($hasLinkDownSignal || in_array($eventLevel, ['critical', 'major'])) {
                $eventType = 'PORT_DOWN';
                $eventLabel = 'SFP Dicabut / Port Link Down';
                $isLoss = true;
            } elseif ($hasLinkUpSignal || $eventLevel === 'cleared') {
                $eventType = 'PORT_UP';
                $eventLabel = 'SFP Terpasang / Port Link Up';
                $isLoss = false;
            }
        }

        // A. Berdasarkan eventLevel ZTE untuk ONU
        if (!$eventType) {
            if ($eventLevel === 'cleared') {
                $eventType = 'RECOVERY';
                $eventLabel = 'Koneksi Pulih (Online)';
                $isLoss = false;
            } elseif ($eventLevel === 'critical') {
                $eventType = 'LOS';
                $eventLabel = 'Loss of Signal (Kabel Putus / LOS)';
                $isLoss = true;
            } elseif ($eventLevel === 'major') {
                $eventType = 'DYING_GASP';
                $eventLabel = 'Dying Gasp (Mati Listrik / Power Cut)';
                $isLoss = true;
            } elseif ($eventLevel === 'warning' || $eventLevel === 'minor') {
                $eventType = 'OPTICAL_WARNING';
                $eventLabel = 'Peringatan Redaman Kritis / Marginal';
                $isLoss = false;
            }
        }

        // B. Fallback / Tambahan jika tidak ada eventLevel eksplisit (Syslog / Text Traps)
        if (!$eventType) {
            if (preg_match('/(Dying\s*Gasp|Power\s*off|Power\s*fail)/i', $cleanString)) {
                $eventType = 'DYING_GASP';
                $eventLabel = 'Dying Gasp (Mati Listrik / Power Cut)';
                $isLoss = true;
            } elseif (preg_match('/(Loss\s*of\s*Signal|LOS|Wire\s*down|Fiber\s*break|Down|Offline)/i', $cleanString)) {
                $eventType = 'LOS';
                $eventLabel = 'Loss of Signal (Kabel Putus / LOS)';
                $isLoss = true;
            } elseif (preg_match('/(cleared|Online|Up|Working|Recovered)/i', $cleanString)) {
                $eventType = 'RECOVERY';
                $eventLabel = 'Koneksi Pulih (Online)';
                $isLoss = false;
            }
        }

        // Jika tidak ada klasifikasi event yang terdeteksi, abaikan
        if (!$eventType) {
            return null;
        }

        return [
            'serial_number' => $serialNumber,
            'event_type'    => $eventType,
            'event_label'   => $eventLabel ?: 'Event Trap OLT',
            'event_level'   => $eventLevel ?: 'info',
            'is_loss'       => $isLoss,
            'port_ref'      => $portRef,
            'onu_id'        => $onuId,
            'raw_onu_desc'  => $rawOnuDesc,
            'from_ip'       => $fromIp,
            'timestamp'     => now()->toIso8601String(),
            'raw_preview'   => substr($cleanString, 0, 200),
        ];
    }
}
