<?php
// Suppress PHP 8.4 notices & warnings in Adminer 4.8.1
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING & ~E_DEPRECATED);
ini_set('display_errors', '0');

// Fix Windows permission issue on session.save_path
$sessionDir = __DIR__ . '/../storage/framework/sessions';
if (!is_dir($sessionDir)) {
    @mkdir($sessionDir, 0777, true);
}
if (is_dir($sessionDir) && is_writable($sessionDir)) {
    session_save_path($sessionDir);
} else {
    session_save_path(sys_get_temp_dir());
}

require __DIR__ . '/adminer_core.php';
