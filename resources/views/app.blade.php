<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Fiber UNMS — Cinox Media Network</title>

    @php
        $hotFile = public_path('hot');
        if (file_exists($hotFile)) {
            $fp = @fsockopen('127.0.0.1', 5173, $errno, $errstr, 0.1);
            if (!$fp) {
                @unlink($hotFile);
            } else {
                fclose($fp);
            }
        }
    @endphp

    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
    @vite(['resources/css/app.css', 'resources/js/app-entry.jsx'])
</head>
<body class="font-sans">
    <div id="root"></div>
</body>
</html>
