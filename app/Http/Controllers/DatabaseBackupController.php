<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class DatabaseBackupController extends Controller
{
    private string $backupDir;

    public function __construct()
    {
        $this->backupDir = storage_path('app/backups');
        if (!File::exists($this->backupDir)) {
            File::makeDirectory($this->backupDir, 0755, true);
        }
    }

    /**
     * GET /api/database/backups
     * Daftar seluruh file cadangan database yang tersimpan
     */
    public function index()
    {
        $files = File::files($this->backupDir);
        $backups = [];
        $totalSizeBytes = 0;

        foreach ($files as $file) {
            $filename = $file->getFilename();
            // Hanya proses file .sql dan .sql.gz / .json
            if (!preg_match('/\.(sql|gz|sql\.gz)$/i', $filename)) {
                continue;
            }

            $size = $file->getSize();
            $totalSizeBytes += $size;
            $mtime = $file->getMTime();

            // Cek apakah ada metadata pendukung
            $metaFile = $this->backupDir . '/' . $filename . '.meta.json';
            $meta = [];
            if (File::exists($metaFile)) {
                $meta = json_decode(File::get($metaFile), true) ?: [];
            }

            $backups[] = [
                'filename'       => $filename,
                'size_bytes'     => $size,
                'size_formatted' => $this->formatBytes($size),
                'created_at'     => Carbon::createFromTimestamp($mtime)->toIso8601String(),
                'created_human'  => Carbon::createFromTimestamp($mtime)->diffForHumans(),
                'notes'          => $meta['notes'] ?? 'Cadangan Otomatis / Manual Sistem',
                'tables_count'   => $meta['tables_count'] ?? null,
                'records_count'  => $meta['records_count'] ?? null,
                'compressed'     => str_ends_with(strtolower($filename), '.gz'),
                'driver'         => $meta['driver'] ?? config('database.default', 'pgsql'),
            ];
        }

        // Urutkan dari yang terbaru
        usort($backups, fn($a, $b) => strcmp($b['created_at'], $a['created_at']));

        return response()->json([
            'success' => true,
            'data'    => $backups,
            'summary' => [
                'total_files'          => count($backups),
                'total_size_bytes'     => $totalSizeBytes,
                'total_size_formatted' => $this->formatBytes($totalSizeBytes),
                'database_name'        => config('database.connections.pgsql.database', 'fiber_unms_enterprise'),
                'database_driver'      => config('database.default', 'pgsql'),
                'database_host'        => config('database.connections.pgsql.host', '127.0.0.1'),
                'last_backup'          => count($backups) > 0 ? $backups[0]['created_at'] : null,
                'storage_path'         => $this->backupDir,
            ],
        ]);
    }

    /**
     * POST /api/database/backups
     * Membuat file backup baru (.sql / .sql.gz)
     */
    public function store(Request $request)
    {
        $request->validate([
            'notes'      => 'nullable|string|max:255',
            'compress'   => 'nullable|boolean',
            'custom_tag' => 'nullable|string|max:50',
        ]);

        try {
            $dbName = config('database.connections.pgsql.database', 'fiber_unms_enterprise');
            $timestamp = Carbon::now()->format('Y-m-d_H-i-s');
            $tag = $request->input('custom_tag') ? '_' . preg_replace('/[^a-zA-Z0-9_-]/', '', $request->input('custom_tag')) : '';
            $compress = $request->boolean('compress', false);

            $baseFilename = "backup_{$dbName}_{$timestamp}{$tag}.sql";
            $sqlFilePath = $this->backupDir . '/' . $baseFilename;

            // Generate full SQL dump
            $dumpResult = $this->generatePostgresSqlDump($sqlFilePath, $request->input('notes', ''));

            $finalFilename = $baseFilename;

            // Kompresi jika diminta
            if ($compress) {
                $gzFilePath = $sqlFilePath . '.gz';
                $gz = gzopen($gzFilePath, 'w9');
                $fp = fopen($sqlFilePath, 'r');
                while (!feof($fp)) {
                    gzwrite($gz, fread($fp, 1024 * 512));
                }
                fclose($fp);
                gzclose($gz);
                File::delete($sqlFilePath); // Hapus file uncompressed

                $finalFilename = $baseFilename . '.gz';
            }

            // Simpan metadata
            $metaFile = $this->backupDir . '/' . $finalFilename . '.meta.json';
            File::put($metaFile, json_encode([
                'notes'         => $request->input('notes') ?: 'Pencadangan Penuh Database UNMS',
                'created_at'    => Carbon::now()->toIso8601String(),
                'tables_count'  => $dumpResult['tables_count'],
                'records_count' => $dumpResult['records_count'],
                'driver'        => config('database.default', 'pgsql'),
                'database'      => $dbName,
            ], JSON_PRETTY_PRINT));

            return response()->json([
                'success' => true,
                'message' => "Backup database '{$finalFilename}' berhasil dibuat.",
                'data'    => [
                    'filename'       => $finalFilename,
                    'tables_count'   => $dumpResult['tables_count'],
                    'records_count'  => $dumpResult['records_count'],
                    'size_formatted' => $this->formatBytes(File::size($this->backupDir . '/' . $finalFilename)),
                ],
            ]);
        } catch (\Throwable $e) {
            Log::error('Backup database failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat backup database: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * GET /api/database/backups/{filename}/download
     * Mengunduh file backup ke lokal client
     */
    public function download(string $filename)
    {
        $filePath = $this->backupDir . '/' . basename($filename);
        if (!File::exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'File cadangan tidak ditemukan di server.',
            ], 404);
        }

        return response()->download($filePath, $filename, [
            'Content-Type' => 'application/octet-stream',
        ]);
    }

    /**
     * POST /api/database/backups/{filename}/restore
     * Memulihkan database dari file cadangan yang dipilih
     */
    public function restore(Request $request, string $filename)
    {
        $filePath = $this->backupDir . '/' . basename($filename);
        if (!File::exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'File cadangan tidak ditemukan di server.',
            ], 404);
        }

        try {
            @set_time_limit(600);
            @ini_set('memory_limit', '512M');

            // Jika file terkompresi .gz, ekstrak dulu sementara
            $isGz = str_ends_with(strtolower($filename), '.gz');
            $sqlContent = '';

            if ($isGz) {
                $gz = gzopen($filePath, 'r');
                while (!gzeof($gz)) {
                    $sqlContent .= gzread($gz, 1024 * 512);
                }
                gzclose($gz);
            } else {
                $sqlContent = File::get($filePath);
            }

            if (empty(trim($sqlContent))) {
                return response()->json([
                    'success' => false,
                    'message' => 'File backup kosong atau tidak valid.',
                ], 422);
            }

            // Eksekusi SQL restore ke PostgreSQL dalam transaksi atomic dengan session_replication_role
            DB::transaction(function () use ($sqlContent) {
                $replicaSet = false;
                try {
                    DB::statement("SET session_replication_role = 'replica';");
                    $replicaSet = true;
                } catch (\Throwable $e) {
                    // Fallback for non-superuser: defer constraints where possible
                    try {
                        DB::statement("SET CONSTRAINTS ALL DEFERRED;");
                    } catch (\Throwable $ignored) {}
                }

                DB::unprepared($sqlContent);

                if ($replicaSet) {
                    try {
                        DB::statement("SET session_replication_role = 'origin';");
                    } catch (\Throwable $ignored) {}
                }
            });

            // Bersihkan cache aplikasi agar data langsung sinkron
            try {
                \Illuminate\Support\Facades\Artisan::call('cache:clear');
            } catch (\Throwable $ce) {
                // Silent
            }

            // Catat audit log pemulihan
            try {
                \App\Models\AuditLog::record(
                    'UPDATE',
                    'Database Backup & Restore',
                    "Memulihkan database sistem secara penuh dari cadangan '{$filename}'",
                    null,
                    ['filename' => $filename, 'restored_at' => Carbon::now()->toIso8601String()]
                );
            } catch (\Throwable $ae) {
                // Silent
            }

            return response()->json([
                'success' => true,
                'message' => "Database berhasil dipulihkan secara penuh dari cadangan '{$filename}'.",
            ]);
        } catch (\Throwable $e) {
            Log::error('Restore database failed: ' . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
            return response()->json([
                'success' => false,
                'message' => 'Gagal memulihkan database: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * POST /api/database/backups/upload
     * Mengunggah file backup dari komputer lokal
     */
    public function upload(Request $request)
    {
        $request->validate([
            'backup_file' => 'required|file|max:102400', // max 100MB
            'notes'       => 'nullable|string|max:255',
        ]);

        try {
            $file = $request->file('backup_file');
            $origName = $file->getClientOriginalName();

            // Validasi ekstensi
            if (!preg_match('/\.(sql|gz|sql\.gz)$/i', $origName)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Format file tidak didukung. Harap unggah file berekstensi .sql atau .sql.gz',
                ], 422);
            }

            // Sanitize filename
            $safeName = preg_replace('/[^a-zA-Z0-9_.-]/', '_', $origName);
            // Tambahkan timestamp jika sudah ada nama yang sama
            if (File::exists($this->backupDir . '/' . $safeName)) {
                $safeName = time() . '_' . $safeName;
            }

            $file->move($this->backupDir, $safeName);

            // Simpan metadata
            $metaFile = $this->backupDir . '/' . $safeName . '.meta.json';
            File::put($metaFile, json_encode([
                'notes'      => $request->input('notes') ?: 'File Cadangan Hasil Upload',
                'created_at' => Carbon::now()->toIso8601String(),
                'driver'     => config('database.default', 'pgsql'),
                'uploaded'   => true,
            ], JSON_PRETTY_PRINT));

            return response()->json([
                'success' => true,
                'message' => "File cadangan '{$safeName}' berhasil diunggah.",
                'data'    => [
                    'filename'       => $safeName,
                    'size_formatted' => $this->formatBytes(File::size($this->backupDir . '/' . $safeName)),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal mengunggah file cadangan: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * DELETE /api/database/backups/{filename}
     * Menghapus file backup
     */
    public function destroy(string $filename)
    {
        $filePath = $this->backupDir . '/' . basename($filename);
        $metaPath = $this->backupDir . '/' . basename($filename) . '.meta.json';

        if (!File::exists($filePath)) {
            return response()->json([
                'success' => false,
                'message' => 'File cadangan tidak ditemukan.',
            ], 404);
        }

        File::delete($filePath);
        if (File::exists($metaPath)) {
            File::delete($metaPath);
        }

        return response()->json([
            'success' => true,
            'message' => "File cadangan '{$filename}' berhasil dihapus.",
        ]);
    }

    /**
     * Engine SQL Generator PostgreSQL yang mengekstrak seluruh 52 tabel beserta data
     */
    private function generatePostgresSqlDump(string $targetPath, string $notes): array
    {
        $dbName = config('database.connections.pgsql.database', 'fiber_unms_enterprise');
        $handle = fopen($targetPath, 'w');

        // Header SQL
        fwrite($handle, "-- ==========================================================\n");
        fwrite($handle, "-- FIBER-UNMS ENTERPRISE DATABASE BACKUP\n");
        fwrite($handle, "-- Database: {$dbName}\n");
        fwrite($handle, "-- Tanggal Pembuatan: " . Carbon::now()->toDateTimeString() . "\n");
        fwrite($handle, "-- Catatan: " . addslashes($notes) . "\n");
        fwrite($handle, "-- Engine: PostgreSQL Native Dump Exporter\n");
        fwrite($handle, "-- ==========================================================\n\n");
        fwrite($handle, "SET statement_timeout = 0;\n");
        fwrite($handle, "SET lock_timeout = 0;\n");
        fwrite($handle, "SET client_encoding = 'UTF8';\n");
        fwrite($handle, "SET standard_conforming_strings = on;\n");
        fwrite($handle, "SET check_function_bodies = false;\n");
        fwrite($handle, "SET client_min_messages = warning;\n");
        fwrite($handle, "SET row_security = off;\n");
        fwrite($handle, "SET session_replication_role = 'replica';\n\n");

        // Dapatkan seluruh tabel di schema public
        $tablesRaw = DB::select("
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
            ORDER BY table_name
        ");

        $tableNames = array_column($tablesRaw, 'table_name');
        $totalRecords = 0;

        // Kosongkan seluruh tabel sekaligus di awal dengan TRUNCATE CASCADE
        if (!empty($tableNames)) {
            $quotedTables = implode(', ', array_map(fn($t) => "\"{$t}\"", $tableNames));
            fwrite($handle, "-- Kosongkan seluruh data tabel sebelum pemulihan\n");
            fwrite($handle, "TRUNCATE TABLE {$quotedTables} CASCADE;\n\n");
        }

        foreach ($tableNames as $tableName) {
            fwrite($handle, "-- ----------------------------------------------------------\n");
            fwrite($handle, "-- Data Tabel: \"{$tableName}\"\n");
            fwrite($handle, "-- ----------------------------------------------------------\n\n");

            // Dump Data Baris (chunk 200 baris per query)
            $count = DB::table($tableName)->count();
            $totalRecords += $count;

            if ($count > 0) {
                DB::table($tableName)->orderBy(DB::raw('1'))->chunk(200, function ($rows) use ($handle, $tableName) {
                    if ($rows->isEmpty()) return;

                    $first = (array) $rows->first();
                    $columns = array_keys($first);
                    $escapedCols = array_map(fn($col) => "\"{$col}\"", $columns);
                    $colList = implode(', ', $escapedCols);

                    $insertStatements = [];
                    foreach ($rows as $row) {
                        $values = [];
                        foreach ((array)$row as $val) {
                            if (is_null($val)) {
                                $values[] = 'NULL';
                            } elseif (is_bool($val)) {
                                $values[] = $val ? 'TRUE' : 'FALSE';
                            } elseif (is_numeric($val)) {
                                $values[] = $val;
                            } elseif (is_array($val) || is_object($val)) {
                                $values[] = "'" . pg_escape_string(json_encode($val)) . "'";
                            } else {
                                $values[] = "'" . pg_escape_string((string)$val) . "'";
                            }
                        }
                        $insertStatements[] = "(" . implode(', ', $values) . ")";
                    }

                    fwrite($handle, "INSERT INTO \"{$tableName}\" ({$colList}) VALUES\n" . implode(",\n", $insertStatements) . ";\n\n");
                });
            }

            // Reset sequence jika ada kolom serial / sequence
            $sequences = DB::select("
                SELECT column_name, pg_get_serial_sequence('\"' || table_name || '\"', column_name) as seq_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = ? AND pg_get_serial_sequence('\"' || table_name || '\"', column_name) IS NOT NULL
            ", [$tableName]);

            foreach ($sequences as $seq) {
                if ($seq->seq_name) {
                    fwrite($handle, "SELECT setval('{$seq->seq_name}', COALESCE((SELECT MAX(\"{$seq->column_name}\") FROM \"{$tableName}\"), 1), true);\n");
                }
            }

            fwrite($handle, "\n");
        }

        // Kembalikan session_replication_role ke default origin
        fwrite($handle, "-- Aktifkan kembali Foreign Key & Trigger\n");
        fwrite($handle, "SET session_replication_role = 'origin';\n\n");

        fclose($handle);

        return [
            'tables_count'  => count($tableNames),
            'records_count' => $totalRecords,
        ];
    }

    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);
        $bytes /= pow(1024, $pow);

        return round($bytes, $precision) . ' ' . $units[$pow];
    }
}
