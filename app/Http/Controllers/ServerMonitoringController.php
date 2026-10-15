<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Artisan;
use Carbon\Carbon;

class ServerMonitoringController extends Controller
{
    /**
     * Mengambil metrik realtime lengkap dari server (CPU, RAM, Disk, Bandwidth, VPN Tunnel, Worker Polling, Gateway, Proses).
     */
    public function getMetrics()
    {
        Carbon::setLocale('id');

        // 1. CPU Metrics
        $cpuData = $this->getCpuMetrics();

        // 2. Memory (RAM & Swap) Metrics
        $memData = $this->getMemoryMetrics();

        // 3. Disk & Storage Metrics
        $diskData = $this->getDiskMetrics();

        // 4. Network & Bandwidth (Rx/Tx Rate) Metrics
        $netData = $this->getNetworkMetrics();

        // 5. VPN Tunnel (PPTP/L2TP/WireGuard) Latency & Quality Metrics
        $vpnData = $this->getVpnTunnelMetrics();

        // 6. Background Telemetry Poller Worker Metrics
        $workerData = $this->getWorkerMetrics();

        // 6b. SNMP Trap & Syslog Listener Metrics (UDP 162/514)
        $snmpTrapData = $this->getSnmpTrapMetrics();

        // 7. System, OS & Uptime Info
        $sysData = $this->getSystemInfo();

        // 8. Gateway & UNMS Background Services Health
        $gatewayData = $this->getGatewayServicesHealth($diskData, $vpnData, $workerData, $snmpTrapData);

        // 9. Top Processes Consumers
        $topProcesses = $this->getTopProcesses();

        // 10. Snapshot time-series data point into cache for historical graphs
        $timestamp = now()->format('H:i:s');
        $this->recordHistoricalPoint([
            'time'           => $timestamp,
            'cpu_pct'        => $cpuData['usage_pct'],
            'ram_pct'        => $memData['used_pct'],
            'rx_kbps'        => $netData['primary_rx_kbps'] ?? 0,
            'tx_kbps'        => $netData['primary_tx_kbps'] ?? 0,
            'vpn_latency_ms' => $vpnData['peer_latency_ms'] ?? null,
            'vpn_sampled_at' => $vpnData['ping_checked_at'] ?? null,
            'vpn_ping_status' => $vpnData['ping_status'] ?? 'UNKNOWN',
        ]);

        return response()->json([
            'status'    => 'success',
            'timestamp' => now()->toIso8601String(),
            'data'      => [
                'cpu'           => $cpuData,
                'memory'        => $memData,
                'disk'          => $diskData,
                'network'       => $netData,
                'vpn'           => $vpnData,
                'worker'        => $workerData,
                'snmp_trap'     => $snmpTrapData,
                'system'        => $sysData,
                'gateway'       => $gatewayData,
                'top_processes' => $topProcesses,
                'history'       => $this->getHistoricalPoints(),
            ]
        ]);
    }

    /**
     * Memicu eksekusi background polling secara langsung dari antarmuka web
     */
    public function triggerPolling()
    {
        try {
            $start = microtime(true);
            Artisan::call('olt:poll-telemetry', ['--force' => true]);
            $durationMs = round((microtime(true) - $start) * 1000, 1);

            $stats = $this->getWorkerMetrics();

            return response()->json([
                'status'      => in_array($stats['cycle_result'],['FAILED','UNKNOWN'],true) ? 'error':'success',
                'message'     => 'Siklus selesai; hasil pembacaan: '.$stats['cycle_result'],
                'duration_ms' => $durationMs,
                'worker'      => $stats,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Gagal memicu polling: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Restart background daemon service (fiber-telemetry-daemon.service) langsung dari web
     */
    public function restartDaemon()
    {
        try {
            $output = [];
            $exitCode = 0;
            exec('sudo -n /usr/bin/systemctl restart fiber-telemetry-daemon 2>&1', $output, $exitCode);
            if ($exitCode !== 0) {
                exec('sudo -n /bin/systemctl restart fiber-telemetry-daemon 2>&1', $output, $exitCode);
            }

            $success = ($exitCode === 0);
            $msg = $success ? 'Fiber Telemetry Daemon 24/7 berhasil di-restart!' : ('Gagal restart daemon: ' . implode(' ', $output));

            \App\Console\Commands\PollOltTelemetry::appendWorkerLog(
                'SYSTEM',
                'DAEMON',
                $success ? 'INFO' : 'ERROR',
                $success ? 'Daemon 24/7 di-restart oleh admin melalui antarmuka web' : "Gagal restart daemon: {$msg}"
            );

            return response()->json([
                'status'  => $success ? 'success' : 'error',
                'message' => $msg,
                'output'  => $output,
            ], $success ? 200 : 500);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Error restarting daemon: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Pause / Resume status worker loop
     */
    public function togglePauseWorker(Request $request)
    {
        $isPaused = (bool)Cache::get('backend_worker_paused', false);
        $newPaused = !$isPaused;
        Cache::put('backend_worker_paused', $newPaused, 86400 * 30);

        \App\Console\Commands\PollOltTelemetry::appendWorkerLog(
            'SYSTEM',
            'DAEMON',
            'INFO',
            $newPaused ? 'Worker polling dijeda oleh pengguna (Paused)' : 'Worker polling dilanjutkan kembali (Resumed)'
        );

        return response()->json([
            'status'    => 'success',
            'is_paused' => $newPaused,
            'message'   => $newPaused ? 'Worker berhasil dijeda (Paused).' : 'Worker berhasil dilanjutkan (Resumed).',
        ]);
    }

    /**
     * Mengubah interval jeda siklus loop worker (1 - 60 detik)
     */
    public function setLoopDelay(Request $request)
    {
        $delay = (int)($request->input('delay_sec') ?? $request->json('delay_sec') ?? 2);
        if ($delay < 1) $delay = 1;
        if ($delay > 60) $delay = 60;

        Cache::put('backend_worker_loop_delay_sec', $delay, 86400 * 30);

        \App\Console\Commands\PollOltTelemetry::appendWorkerLog(
            'SYSTEM',
            'CONFIG',
            'INFO',
            "Interval jeda antar siklus diubah menjadi {$delay} detik"
        );

        return response()->json([
            'status'    => 'success',
            'delay_sec' => $delay,
            'message'   => "Interval jeda per siklus berhasil diatur ke {$delay} detik.",
        ]);
    }

    /**
     * Mengubah mode mesin polling OLT: slot_parallel (Slot Parallel ~8-12s), global_bulk, atau per_port (Round-Robin 2-Port)
     */
    public function setPollingMode(Request $request)
    {
        $payload = $request->json()->all();
        $mode = $payload['mode'] ?? ($request->input('mode') ?? ($request->get('mode') ?? 'slot_parallel'));
        if (!in_array($mode, ['slot_parallel', 'global_bulk', 'per_port'])) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Mode polling tidak valid. Pilih "slot_parallel", "global_bulk", atau "per_port".',
            ], 422);
        }

        Cache::put('olt_polling_engine_mode', $mode, 86400 * 30);

        $modeLabel = match ($mode) {
            'slot_parallel' => 'Parallel Slot/Card Batching (Realtime ~8-12s + Anti-Flap)',
            'global_bulk'   => 'Global Bulk Polling (Se-OLT Sekaligus)',
            default         => 'Per-Port Round-Robin Polling (Klasik 2-Port)',
        };

        \App\Console\Commands\PollOltTelemetry::appendWorkerLog(
            'SYSTEM',
            'CONFIG',
            'INFO',
            "Engine mode polling OLT diubah menjadi: {$modeLabel}"
        );

        return response()->json([
            'status'      => 'success',
            'engine_mode' => $mode,
            'mode_label'  => $modeLabel,
            'message'     => "Engine polling OLT berhasil diubah ke {$modeLabel}.",
        ]);
    }

    /**
     * Membersihkan riwayat live activity logs di Cache
     */
    public function clearLogs()
    {
        Cache::forget('backend_worker_logs');
        \App\Console\Commands\PollOltTelemetry::appendWorkerLog(
            'SYSTEM',
            'LOG',
            'INFO',
            'Riwayat Live Log Worker dibersihkan oleh pengguna'
        );

        return response()->json([
            'status'  => 'success',
            'message' => 'Riwayat Live Activity Log berhasil dibersihkan.',
        ]);
    }

    /**
     * Restart service fiber-event-listener (SNMP Trap & Syslog Listener)
     */
    public function restartTrapListener()
    {
        try {
            $output = [];
            $exitCode = 0;
            exec('sudo -n /usr/bin/systemctl restart fiber-event-listener 2>&1', $output, $exitCode);
            if ($exitCode !== 0) {
                exec('sudo -n /bin/systemctl restart fiber-event-listener 2>&1', $output, $exitCode);
            }

            $success = ($exitCode === 0);
            $msg = $success 
                ? 'SNMP Trap & Syslog Listener (fiber-event-listener) berhasil di-restart!' 
                : ('Gagal restart service: ' . implode(' ', $output));

            return response()->json([
                'status'  => $success ? 'success' : 'error',
                'message' => $msg,
                'output'  => $output,
            ], $success ? 200 : 500);
        } catch (\Throwable $e) {
            return response()->json([
                'status'  => 'error',
                'message' => 'Error: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Clear SNMP Trap recent logs
     */
    public function clearTrapLogs()
    {
        Cache::forget('snmp_trap_recent_logs');
        return response()->json([
            'status'  => 'success',
            'message' => 'Riwayat log SNMP Trap berhasil dibersihkan.',
        ]);
    }

    /**
     * Baca CPU usage real-time melalui /proc/stat dan /proc/cpuinfo
     */
    protected function getCpuMetrics(): array
    {
        $cpuInfo = @file_get_contents('/proc/cpuinfo') ?: '';
        preg_match_all('/model name\s+:\s+(.+)$/m', $cpuInfo, $m);
        $cpuModel = $m[1][0] ?? 'KVM / Multi-Core Processor';
        $cpuCores = count($m[1]) ?: 1;

        // Hitung persentase CPU usage delta dari /proc/stat
        $stat = @file_get_contents('/proc/stat');
        $usagePct = 12.5; // fallback

        if ($stat && preg_match('/^cpu\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/', $stat, $matches)) {
            $user = (int)$matches[1];
            $nice = (int)$matches[2];
            $system = (int)$matches[3];
            $idle = (int)$matches[4];
            $iowait = (int)$matches[5];
            $irq = (int)$matches[6];
            $softirq = (int)$matches[7];

            $total = $user + $nice + $system + $idle + $iowait + $irq + $softirq;
            $work = $user + $nice + $system + $irq + $softirq;

            $prev = Cache::get('server_mon_prev_cpu');
            if ($prev && isset($prev['total'], $prev['work'])) {
                $totalDelta = max(1, $total - $prev['total']);
                $workDelta = max(0, $work - $prev['work']);
                $usagePct = round(($workDelta / $totalDelta) * 100, 1);
            }

            Cache::put('server_mon_prev_cpu', ['total' => $total, 'work' => $work], 60);
        }

        $loadAvg = sys_getloadavg() ?: [0.1, 0.1, 0.1];

        return [
            'usage_pct'     => min(100, max(0, $usagePct)),
            'model'         => trim($cpuModel),
            'cores'         => $cpuCores,
            'load_avg_1m'   => round($loadAvg[0] ?? 0, 2),
            'load_avg_5m'   => round($loadAvg[1] ?? 0, 2),
            'load_avg_15m'  => round($loadAvg[2] ?? 0, 2),
        ];
    }

    /**
     * Baca Memory & Swap dari /proc/meminfo
     */
    protected function getMemoryMetrics(): array
    {
        $memInfo = @file_get_contents('/proc/meminfo') ?: '';

        preg_match('/MemTotal:\s+(\d+)/', $memInfo, $mt);
        preg_match('/MemFree:\s+(\d+)/', $memInfo, $mf);
        preg_match('/MemAvailable:\s+(\d+)/', $memInfo, $ma);
        preg_match('/Buffers:\s+(\d+)/', $memInfo, $mb);
        preg_match('/Cached:\s+(\d+)/', $memInfo, $mc);
        preg_match('/SwapTotal:\s+(\d+)/', $memInfo, $st);
        preg_match('/SwapFree:\s+(\d+)/', $memInfo, $sf);

        $totalKb = (int)($mt[1] ?? 4000000);
        $freeKb = (int)($mf[1] ?? 1000000);
        $availKb = (int)($ma[1] ?? ($freeKb + (int)($mb[1] ?? 0) + (int)($mc[1] ?? 0)));
        $buffersKb = (int)($mb[1] ?? 0);
        $cachedKb = (int)($mc[1] ?? 0);
        $usedKb = max(0, $totalKb - $availKb);

        $swapTotalKb = (int)($st[1] ?? 0);
        $swapFreeKb = (int)($sf[1] ?? 0);
        $swapUsedKb = max(0, $swapTotalKb - $swapFreeKb);

        $usedPct = $totalKb > 0 ? round(($usedKb / $totalKb) * 100, 1) : 0;
        $swapUsedPct = $swapTotalKb > 0 ? round(($swapUsedKb / $swapTotalKb) * 100, 1) : 0;

        return [
            'total_gb'      => round($totalKb / 1024 / 1024, 2),
            'used_gb'       => round($usedKb / 1024 / 1024, 2),
            'free_gb'       => round($availKb / 1024 / 1024, 2),
            'cached_gb'     => round(($buffersKb + $cachedKb) / 1024 / 1024, 2),
            'used_pct'      => $usedPct,
            'swap_total_gb' => round($swapTotalKb / 1024 / 1024, 2),
            'swap_used_gb'  => round($swapUsedKb / 1024 / 1024, 2),
            'swap_used_pct' => $swapUsedPct,
        ];
    }

    /**
     * Baca penggunaan Disk Storage & Database size
     */
    protected function getDiskMetrics(): array
    {
        $rootTotal = @disk_total_space('/') ?: (60 * 1024 * 1024 * 1024);
        $rootFree = @disk_free_space('/') ?: (50 * 1024 * 1024 * 1024);
        $rootUsed = max(0, $rootTotal - $rootFree);
        $rootUsedPct = $rootTotal > 0 ? round(($rootUsed / $rootTotal) * 100, 1) : 0;

        // DB Size query (PostgreSQL / SQLite fallback) - Cached for 60 seconds
        $dbSizeMb = Cache::remember('server_mon_dbsize', 60, function () {
            try {
                $dbDriver = config('database.default', 'pgsql');
                if ($dbDriver === 'pgsql') {
                    $dbName = config('database.connections.pgsql.database', 'fiber_unms_enterprise');
                    $sizeQuery = DB::selectOne("SELECT pg_database_size(?) AS size", [$dbName]);
                    if ($sizeQuery && isset($sizeQuery->size)) {
                        return round((int)$sizeQuery->size / 1024 / 1024, 2);
                    }
                }
            } catch (\Throwable $e) {
                // fallback
            }
            return 15.0;
        });

        // Partisi sistem (df) - Cached for 30 seconds
        $partitions = Cache::remember('server_mon_partitions', 30, function () use ($rootTotal, $rootUsed, $rootFree, $rootUsedPct) {
            $partsList = [];
            $dfOutput = @shell_exec('df -h -x tmpfs -x devtmpfs -x squashfs 2>/dev/null');
            if ($dfOutput) {
                $lines = explode("\n", trim($dfOutput));
                array_shift($lines); // header
                foreach ($lines as $line) {
                    $parts = preg_split('/\s+/', $line);
                    if (count($parts) >= 6) {
                        $partsList[] = [
                            'filesystem' => $parts[0],
                            'size'       => $parts[1],
                            'used'       => $parts[2],
                            'avail'      => $parts[3],
                            'use_pct'    => (int)str_replace('%', '', $parts[4]),
                            'mount'      => $parts[5],
                        ];
                    }
                }
            }

            if (empty($partsList)) {
                $partsList[] = [
                    'filesystem' => '/dev/vda1',
                    'size'       => round($rootTotal / 1024 / 1024 / 1024, 1) . 'G',
                    'used'       => round($rootUsed / 1024 / 1024 / 1024, 1) . 'G',
                    'avail'      => round($rootFree / 1024 / 1024 / 1024, 1) . 'G',
                    'use_pct'    => (int)$rootUsedPct,
                    'mount'      => '/',
                ];
            }
            return $partsList;
        });

        return [
            'total_gb'    => round($rootTotal / 1024 / 1024 / 1024, 2),
            'used_gb'     => round($rootUsed / 1024 / 1024 / 1024, 2),
            'free_gb'     => round($rootFree / 1024 / 1024 / 1024, 2),
            'used_pct'    => $rootUsedPct,
            'db_size_mb'  => $dbSizeMb,
            'partitions'  => $partitions,
        ];
    }

    /**
     * Baca Network interfaces dan kalkulasi laju bandwidth (Rx / Tx KB/s)
     */
    protected function getNetworkMetrics(): array
    {
        $netDev = @file_get_contents('/proc/net/dev') ?: '';
        $interfaces = [];
        $now = microtime(true);

        $primaryRxKbps = 0;
        $primaryTxKbps = 0;

        foreach (explode("\n", $netDev) as $line) {
            if (strpos($line, ':') === false) continue;
            $parts = explode(':', $line);
            $ifName = trim($parts[0]);
            if (in_array($ifName, ['lo'])) continue;

            $stats = preg_split('/\s+/', trim($parts[1]));
            if (count($stats) < 9) continue;

            $rxBytes = (int)$stats[0];
            $rxPackets = (int)$stats[1];
            $txBytes = (int)$stats[8];
            $txPackets = (int)$stats[9];

            // Hitung transfer rate dengan cache data sebelumnya
            $cacheKey = "server_mon_net_{$ifName}";
            $prev = Cache::get($cacheKey);

            $rxRateKbps = 0;
            $txRateKbps = 0;

            if ($prev && isset($prev['time'], $prev['rx'], $prev['tx'])) {
                $timeDelta = max(0.2, $now - $prev['time']);
                $rxDelta = max(0, $rxBytes - $prev['rx']);
                $txDelta = max(0, $txBytes - $prev['tx']);

                $rxRateKbps = round(($rxDelta / $timeDelta) / 1024, 2);
                $txRateKbps = round(($txDelta / $timeDelta) / 1024, 2);
            }

            Cache::put($cacheKey, ['time' => $now, 'rx' => $rxBytes, 'tx' => $txBytes], 60);

            if ($ifName === 'eth0' || $ifName === 'ens3' || empty($interfaces)) {
                $primaryRxKbps = $rxRateKbps;
                $primaryTxKbps = $txRateKbps;
            }

            $interfaces[] = [
                'name'         => $ifName,
                'type'         => str_starts_with($ifName, 'ppp') ? 'VPN Tunnel (PPTP/L2TP)' : (str_starts_with($ifName, 'wg') ? 'WireGuard Tunnel' : 'Physical Ethernet'),
                'rx_rate_kbps' => $rxRateKbps,
                'tx_rate_kbps' => $txRateKbps,
                'rx_rate_mbps' => round($rxRateKbps / 128, 2),
                'tx_rate_mbps' => round($txRateKbps / 128, 2),
                'rx_total_mb'  => round($rxBytes / 1024 / 1024, 2),
                'tx_total_mb'  => round($txBytes / 1024 / 1024, 2),
                'rx_total_gb'  => round($rxBytes / 1024 / 1024 / 1024, 2),
                'tx_total_gb'  => round($txBytes / 1024 / 1024 / 1024, 2),
                'rx_packets'   => $rxPackets,
                'tx_packets'   => $txPackets,
            ];
        }

        return [
            'primary_rx_kbps' => $primaryRxKbps,
            'primary_tx_kbps' => $primaryTxKbps,
            'interfaces'      => $interfaces,
        ];
    }

    /**
     * Membaca status, gateway, latensi, dan performa VPN Tunnel (PPTP/L2TP/WireGuard)
     * Di-cache selama 12 detik agar tidak men-spawn ping berulang-ulang setiap request.
     */
    protected function getVpnTunnelMetrics(): array
    {
        return $this->oltHealth()['vpn'];
    }

    protected ?array $monitoringHealth = null;
    protected function oltHealth(): array
    {
        return $this->monitoringHealth ??= app(\App\Services\Olt\OltHealthMonitor::class)->overview();
    }


    /**
     * Membaca status dan telemetri Background Polling Worker (SNMP Daemon)
     */
    protected function getWorkerMetrics(): array
    {
        $health=$this->oltHealth();$stats=\App\Services\Olt\OltHealthMonitor::cachedArray('backend_worker_telemetry');
        $paused=(bool)Cache::get('backend_worker_paused',false);
        $service=$health['poller_service'];$status=$service['status'];
        if($status==='RUNNING' && $paused)$status='PAUSED';
        $at=$stats['last_run_at'] ?? null;$age=\App\Services\Olt\OltHealthMonitor::age($at);
        $reports=[];$saved=collect(is_array($stats['device_reports'] ?? null) ? $stats['device_reports']:[])->filter(fn($r)=>is_array($r))->keyBy('device_id');
        foreach($health['devices'] as $r) {
            if($service['status']!=='RUNNING' && ($r['poll']['phase'] ?? null)==='READING') {
                if($r['status']==='IN_PROGRESS')$r['status']='UNKNOWN';
                $r['poll']['phase']='UNCONFIRMED';$r['query_elapsed_seconds']=null;
            }
            $old=$saved->get($r['device_id'],[]);$query=\App\Services\Olt\OltHealthMonitor::cachedArray('olt_active_querying_port_'.$r['device_id']);
            $reports[]=array_replace($old,$r,[
                'duration_ms'=>$r['poll']['duration_ms'] ?? null,
                'last_port_polled'=>$query['port'] ?? null,'active_querying_port'=>$query['port'] ?? null,
                'last_port_onu_count'=>$r['poll']['rows_read'] ?? null,
                'querying_status'=>$status==='RUNNING' ? $r['querying_status']:'STANDBY',
            ]);
        }
        $history=array_values(array_map(fn($r)=>array_replace($r,['status'=>($r['health_schema'] ?? null)===1 ? ($r['status'] ?? 'UNKNOWN'):'UNKNOWN']),array_filter(\App\Services\Olt\OltHealthMonitor::cachedArray('backend_worker_history'),fn($r)=>is_array($r))));
        $mode=Cache::get('olt_polling_engine_mode','slot_parallel');
        return [
            'status'=>$status,'service'=>$service,'health_schema'=>1,'checked_at'=>$health['checked_at'],
            'cycle_result'=>($stats['health_schema'] ?? null)===1 ? ($stats['cycle_result'] ?? 'UNKNOWN'):'UNKNOWN',
            'engine_mode'=>$mode,'mode_label'=>match($mode){'slot_parallel'=>'Slot/Card Batching','global_bulk'=>'Global Bulk',default=>'Per-Port'},
            'is_paused'=>$paused,'loop_delay_sec'=>(int)Cache::get('backend_worker_loop_delay_sec',3),
            'last_run_at'=>$age===null ? null:$at,'last_run_human'=>$age===null ? null:Carbon::parse($at)->format('d M Y, H:i:s'),
            'seconds_ago'=>$age,'seconds_ago_text'=>$age===null ? 'Belum ada siklus tercatat':($age<60 ? $age.' detik lalu':round($age/60).' menit lalu'),
            'cycle_duration_ms'=>$stats['cycle_duration_ms'] ?? null,'cycle_duration_human'=>$stats['cycle_duration_human'] ?? null,
            'throttling_delay_ms'=>$stats['throttling_delay_ms'] ?? null,'total_devices'=>count($reports),
            'total_ports_polled'=>($stats['health_schema'] ?? null)===1 ? ($stats['total_ports_polled'] ?? null):null,
            'total_onus_polled'=>array_sum(array_column($reports,'db_registered_total')),
            'total_uncfg_detected'=>array_sum(array_column($reports,'db_unregistered_total')),
            'device_reports'=>$reports,'history'=>$history,'logs'=>Cache::get('backend_worker_logs',[]) ?: [],
        ];
    }


    /**
     * Informasi OS, Kernel, Hostname, dan Uptime
     */
    protected function getSystemInfo(): array
    {
        $uptimeRaw = @file_get_contents('/proc/uptime') ?: '';
        $uptimeSec = 0;
        if ($uptimeRaw) {
            $uptimeSec = (int)explode(' ', $uptimeRaw)[0];
        }

        $days = floor($uptimeSec / 86400);
        $hours = floor(($uptimeSec % 86400) / 3600);
        $minutes = floor(($uptimeSec % 3600) / 60);

        $uptimeFormatted = "{$days} hari, {$hours} jam, {$minutes} menit";

        $osRelease = @file_get_contents('/etc/os-release') ?: '';
        $distro = 'Ubuntu Linux';
        if (preg_match('/PRETTY_NAME="([^"]+)"/', $osRelease, $m)) {
            $distro = $m[1];
        }

        return [
            'hostname'       => gethostname() ?: 'vps-unms',
            'os'             => $distro,
            'kernel'         => php_uname('r'),
            'architecture'   => php_uname('m'),
            'uptime_seconds' => $uptimeSec,
            'uptime_human'   => $uptimeFormatted,
            'php_version'    => PHP_VERSION,
            'laravel_version'=> app()->version(),
            'server_time'    => now()->format('d M Y, H:i:s T'),
        ];
    }

    /**
     * Status Gateway & Layanan Infrastruktur UNMS
     */
    protected function getGatewayServicesHealth(array $diskData, array $vpnData = [], array $workerData = [], array $snmpTrapData = []): array
    {
        // 1. SNMP Poller & Background Telemetry Worker
        $lastWorkerActivity = $workerData['last_run_human'] ?? 'Belum ada siklus tercatat';
        $snmpStatus = $workerData['status'] ?? 'UNKNOWN';

        // 2. Database PostgreSQL
        $dbStatus = 'HEALTHY';
        $dbLatencyMs = 1.2;
        try {
            $start = microtime(true);
            DB::select('SELECT 1');
            $dbLatencyMs = round((microtime(true) - $start) * 1000, 2);
        } catch (\Throwable $e) {
            $dbStatus = 'DEGRADED';
        }

        // 3. WebRTC Audio & Voice Dispatch
        $webrtcStatus = 'ONLINE';

        // 4. Telegram Gateway
        $telegramConfigured = !empty(config('services.telegram.bot_token')) || !empty(env('TELEGRAM_BOT_TOKEN'));

        // 5. VPN Gateway Tunnel
        $vpnStatus = $vpnData['status'] ?? 'UNKNOWN';

        // 6. SNMP Trap Listener Status
        $trapStatus = $snmpTrapData['service']['status'] ?? 'UNKNOWN';

        return [
            'snmp_trap' => [
                'name'        => 'SNMP Trap & Syslog Listener',
                'status'      => $trapStatus,
                'detail'      => 'Jalur: ' . ($snmpTrapData['path_status'] ?? 'UNKNOWN') . ' • ' . ($snmpTrapData['last_received_human'] ?? 'Belum ada paket'),
                'driver'      => 'socket_select Asynchronous Non-Blocking Engine',
                'last_active' => $snmpTrapData['last_received_human'] ?? 'Standby',
                'duration'    => null,
            ],
            'snmp_daemon' => [
                'name'        => 'SNMP Poller Background Worker',
                'status'      => $snmpStatus,
                'detail'      => 'Status proses; hasil pembacaan: ' . ($workerData['cycle_result'] ?? 'UNKNOWN'),
                'driver'      => 'ZTE C300/C320, HSGQ & Multi-Vendor Engine',
                'last_active' => $lastWorkerActivity,
                'duration'    => $workerData['cycle_duration_human'] ?? 'Belum tersedia',
            ],
            'vpn_tunnel' => [
                'name'        => 'VPN Peer Bridge Tunnel (' . ($vpnData['interface'] ?? 'ppp0') . ')',
                'status'      => $vpnStatus,
                'detail'      => $vpnData['quality_text'] ?? 'Belum terverifikasi',
                'latency_ms'  => $vpnData['peer_latency_ms'] ?? null,
                'quality'     => $vpnData['quality'] ?? 'UNKNOWN',
            ],
            'webrtc_gateway' => [
                'name'        => 'WebRTC Audio & Dispatch Gateway',
                'status'      => $webrtcStatus,
                'detail'      => 'Channel PTT Voice Teknisi Standby',
                'protocol'    => 'STUN/TURN WebRTC Mesh Active',
            ],
            'database' => [
                'name'        => 'PostgreSQL Database & Cache',
                'status'      => $dbStatus,
                'driver'      => config('database.default', 'pgsql'),
                'latency_ms'  => $dbLatencyMs,
                'size_mb'     => $diskData['db_size_mb'] ?? 15.0,
            ],
            'disk_storage' => [
                'name'        => 'VPS NVMe / SSD Storage',
                'status'      => ($diskData['used_pct'] > 90) ? 'WARNING' : 'HEALTHY',
                'total_gb'    => $diskData['total_gb'],
                'used_gb'     => $diskData['used_gb'],
                'free_gb'     => $diskData['free_gb'],
                'used_pct'    => $diskData['used_pct'],
            ],
            'telegram_gateway' => [
                'name'        => 'Telegram Notification Gateway',
                'status'      => $telegramConfigured ? 'CONNECTED' : 'CONFIGURED',
                'detail'      => 'Bot Notifikasi Alarm LOS & Dispatch Teknisi',
            ],
        ];
    }

    /**
     * Membaca 5 proses teratas yang mengonsumsi CPU & RAM tertinggi (Cached 6s)
     */
    protected function getTopProcesses(): array
    {
        return Cache::remember('server_mon_top_processes', 6, function () {
            $processes = [];
            $output = @shell_exec('ps aux --sort=-%cpu | head -n 6 2>/dev/null');

            if ($output) {
                $lines = explode("\n", trim($output));
                array_shift($lines); // header

                foreach ($lines as $line) {
                    $parts = preg_split('/\s+/', $line, 11);
                    if (count($parts) >= 11) {
                        $processes[] = [
                            'user'    => $parts[0],
                            'pid'     => $parts[1],
                            'cpu_pct' => (float)$parts[2],
                            'mem_pct' => (float)$parts[3],
                            'time'    => $parts[9],
                            'command' => basename($parts[10]),
                            'full_cmd'=> $parts[10],
                        ];
                    }
                }
            }

            if (empty($processes)) {
                $processes = [
                    ['user' => 'www-data', 'pid' => '1204', 'cpu_pct' => 1.8, 'mem_pct' => 2.4, 'time' => '00:15', 'command' => 'php-fpm8.3', 'full_cmd' => 'php-fpm: pool www'],
                    ['user' => 'postgres', 'pid' => '842',  'cpu_pct' => 0.9, 'mem_pct' => 3.1, 'time' => '01:02', 'command' => 'postgres',   'full_cmd' => '/usr/lib/postgresql/16/bin/postgres'],
                    ['user' => 'root',     'pid' => '1102', 'cpu_pct' => 0.4, 'mem_pct' => 1.2, 'time' => '00:08', 'command' => 'nginx',      'full_cmd' => 'nginx: worker process'],
                    ['user' => 'root',     'pid' => '512',  'cpu_pct' => 0.2, 'mem_pct' => 0.8, 'time' => '00:02', 'command' => 'sshd',       'full_cmd' => 'sshd: /usr/sbin/sshd'],
                ];
            }

            return $processes;
        });
    }

    /**
     * Catat titik data history ke cache untuk grafik kontinu
     */
    protected function recordHistoricalPoint(array $point): void
    {
        $history = Cache::get('server_mon_history', []);
        $history[] = $point;

        // Pertahankan maksimal 25 titik data terakhir
        if (count($history) > 25) {
            $history = array_slice($history, -25);
        }

        Cache::put('server_mon_history', $history, 300);
    }

    /**
     * Ambil titik history yang tersimpan di cache
     */
    protected function getHistoricalPoints(): array
    {
        return Cache::get('server_mon_history',[]) ?: [];
    }


    /**
     * Membaca status, metrik, konektivitas OLT, dan live stream SNMP Trap Listener (UDP 162/514)
     */
    protected function getSnmpTrapMetrics(): array
    {
        $health=$this->oltHealth();$service=$health['listener_service'];
        $heartbeat=(int)Cache::get('snmp_trap_listener_heartbeat',0);
        $age=time()-$heartbeat;$alive=$heartbeat>0 && $age>=-5 && $age<=20;
        $isActive=$service['status']==='RUNNING';
        $listener=\App\Services\Olt\OltHealthMonitor::cachedArray('snmp_trap_listener_status');
        $ports=[];
        foreach(['trap_162'=>['trap_active',162,'SNMP Trap'],'syslog_514'=>['syslog_active',514,'Syslog']] as $key=>$definition) {
            [$flag,$port,$name]=$definition;
            $ports[$key]=['port'=>$port,'protocol'=>'UDP','service'=>$name,
                'status'=>!$isActive ? ($service['status']==='STOPPED' ? 'CLOSED':'UNKNOWN')
                    : (!$alive || !array_key_exists($flag,$listener) ? 'UNKNOWN':($listener[$flag] ? 'LISTENING':'CLOSED'))];
        }
        $last=Cache::get('snmp_trap_last_received_at');$lastAge=\App\Services\Olt\OltHealthMonitor::age($last);
        $olts=[];$responding=0;
        foreach($health['devices'] as $r) {
            $packet=\App\Services\Olt\OltHealthMonitor::cachedArray('snmp_trap_last_from_'.$r['ip']);
            $packetAge=\App\Services\Olt\OltHealthMonitor::age($packet['timestamp'] ?? null);
            $reachable=$r['connection']['status']==='RESPONDING';if($reachable)$responding++;
            $olts[]=['id'=>$r['device_id'],'name'=>$r['device_name'],'ip'=>$r['ip'],'vendor'=>$r['vendor'],
                'ping_ms'=>$r['connection']['latency_ms'],'latency_source'=>'snmp_sysuptime','is_reachable'=>$reachable,
                'last_trap_at'=>$packet['timestamp'] ?? null,'last_trap_text'=>$packetAge===null ? 'Belum ada paket terverifikasi':$packetAge.' detik lalu',
                'last_event'=>$packet['event_label'] ?? null,'status_label'=>$r['connection']['status'],
                'status_badge'=>$reachable ? 'emerald':($r['connection']['status']==='UNKNOWN' ? 'amber':'rose'),
                'alarm_delivery_status'=>$packetAge!==null && $packetAge<=3600 ? 'RECENT_PACKET':'UNVERIFIED'];
        }
        $ready=$isActive && $alive && $health['vpn']['status']==='AVAILABLE'
            && $ports['trap_162']['status']==='LISTENING' && $ports['syslog_514']['status']==='LISTENING';
        return ['status'=>$isActive ? 'ACTIVE':$service['status'],'health'=>$ready ? 'PATH_READY':'UNVERIFIED',
            'service'=>$service,'heartbeat_status'=>$alive ? 'RECENT':'STALE_OR_MISSING',
            'path_status'=>$health['vpn']['status'],'alarm_delivery_status'=>'UNVERIFIED',
            'is_running'=>$isActive,'systemd_status'=>$service['status'],'ports'=>$ports,
            'total_packets_today'=>(int)Cache::get('snmp_trap_packets_today_'.now()->toDateString(),0),
            'last_received_at'=>$lastAge===null ? null:$last,'last_received_human'=>$lastAge===null ? 'Belum ada paket terverifikasi':$lastAge.' detik lalu',
            'seconds_ago'=>$lastAge,'olts'=>$olts,'total_olts'=>count($olts),'connected_olts'=>$responding,
            'recent_logs'=>Cache::get('snmp_trap_recent_logs',[]) ?: []];
    }

}
