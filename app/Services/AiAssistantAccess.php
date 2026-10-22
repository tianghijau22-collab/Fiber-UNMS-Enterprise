<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Http\Request;

/** AI tools inherit the same read permission as their underlying API. */
class AiAssistantAccess
{
    private const ROUTES = [
        'search_customer' => ['/api/customers'],
        'check_optical_power' => ['/api/customers', '/api/olt/hardware'],
        'search_network_node' => ['/api/network-nodes'],
        'list_critical_attenuations' => ['/api/customers', '/api/olt/hardware'],
        'list_maintenance_nodes' => ['/api/network-nodes'],
        'get_network_summary' => ['/api/dashboard/metrics'],
        'get_recent_tickets' => ['/api/tickets'],
    ];

    public function allows(?User $user, string $tool): bool
    {
        if (!$user || $user->status !== 'Active') return false;
        foreach (self::ROUTES[$tool] ?? [] as $path) {
            $request = Request::create($path, 'GET');
            try { $route = app('router')->getRoutes()->match($request); }
            catch (\Symfony\Component\HttpKernel\Exception\HttpExceptionInterface) { continue; }
            $request->setRouteResolver(fn () => $route);
            if (app(ApiAccessPolicy::class)->allows($user, $request)) return true;
        }
        return false;
    }
}
