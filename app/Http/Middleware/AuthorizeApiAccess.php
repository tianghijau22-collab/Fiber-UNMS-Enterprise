<?php

namespace App\Http\Middleware;

use App\Services\ApiAccessPolicy;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthorizeApiAccess
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Silakan login terlebih dahulu.'], 401);
        }
        if ($user->status !== 'Active') {
            return response()->json(['message' => 'Akun Anda tidak aktif. Silakan hubungi administrator.', 'code' => 'ACCOUNT_INACTIVE'], 403);
        }
        if (!app(ApiAccessPolicy::class)->allows($user, $request)) {
            return response()->json(['message' => 'Anda tidak memiliki izin untuk tindakan ini.'], 403);
        }

        foreach (['X-User-Id', 'X-User-Name', 'X-User-Role'] as $header) {
            $request->headers->remove($header);
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private');
        return $response;
    }
}
