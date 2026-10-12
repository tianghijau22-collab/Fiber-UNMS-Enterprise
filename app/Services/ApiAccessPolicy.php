<?php

namespace App\Services;

use App\Http\Controllers\UserController;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;

class ApiAccessPolicy
{
    public function ruleFor(Route $route): ?array
    {
        $controller = class_basename($route->getControllerClass() ?? '');
        $action = $controller.'@'.$route->getActionMethod();

        return config('api_access.actions.'.$action)
            ?? config('api_access.uris')[$route->uri()] ?? config('api_access.controllers.'.$controller);
    }

    public function permissions(): array
    {
        $defaults = UserController::getDefaultRoutePermissions();
        $raw = SystemSetting::get('rbac_route_permissions');
        if ($raw === null) {
            return $defaults;
        }

        $stored = json_decode($raw, true);
        if (!is_array($stored)) {
            return [];
        }

        foreach ($stored as $page => $roles) {
            $defaults[$page] = is_array($roles) ? array_values(array_filter($roles, 'is_string')) : [];
        }

        return $defaults;
    }

    public function allows(User $user, Request $request): bool
    {
        $rule = $this->ruleFor($request->route());
        if ($rule === null) {
            return false;
        }
        if ($user->role === 'Super Administrator') {
            return true;
        }
        if (isset($rule['roles']) && !in_array($user->role, $rule['roles'], true)) {
            return false;
        }
        if (!$request->isMethodSafe() && isset($rule['write_roles']) && !in_array($user->role, $rule['write_roles'], true)) {
            return false;
        }
        if (isset($rule['pages'])) {
            $permissions = $this->permissions();
            $pages = !$request->isMethodSafe() ? ($rule['write_pages'] ?? $rule['pages']) : $rule['pages'];
            foreach ($pages as $page) {
                $roles = $permissions[$page] ?? [];
                if (in_array($user->role, $roles, true) || in_array('*', $roles, true)) {
                    return true;
                }
            }

            return false;
        }

        return ($rule['authenticated'] ?? false) || isset($rule['roles']);
    }
}
