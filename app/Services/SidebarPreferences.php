<?php

namespace App\Services;

use App\Http\Controllers\UserController;
use App\Models\SystemSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SidebarPreferences
{
    public const KEY = 'sidebar_navigation_preferences';

    public function catalog(): array
    {
        return json_decode(file_get_contents(resource_path('navigation/sidebar.json')),true,512,JSON_THROW_ON_ERROR);
    }

    public function defaults(): array { return ['order'=>$this->catalog(),'super_admin_hidden'=>[]]; }

    public function normalize(mixed $value): array
    {
        $known=$this->catalog();$value=is_array($value)?$value:[];
        $order=array_values(array_unique(array_filter(is_array($value['order']??null)?$value['order']:[],fn($id)=>is_string($id)&&in_array($id,$known,true))));
        return ['order'=>array_merge($order,array_values(array_diff($known,$order))),
            'super_admin_hidden'=>array_values(array_unique(array_filter(is_array($value['super_admin_hidden']??null)?$value['super_admin_hidden']:[],fn($id)=>is_string($id)&&in_array($id,$known,true))))];
    }

    public function validate(array $value): array
    {
        $known=$this->catalog();$order=$value['order']??[];$hidden=$value['super_admin_hidden']??[];
        if (count($order)!==count($known)||count(array_unique($order))!==count($known)||array_diff($known,$order)||array_diff($order,$known)) throw ValidationException::withMessages(['sidebar.order'=>'Urutan harus memuat seluruh menu tepat satu kali. Muat ulang pengaturan.']);
        if (array_diff($hidden,$known)||count(array_unique($hidden))!==count($hidden)) throw ValidationException::withMessages(['sidebar.super_admin_hidden'=>'Daftar menu tersembunyi tidak valid.']);
        return ['order'=>array_values($order),'super_admin_hidden'=>array_values($hidden)];
    }

    public function snapshot(): array
    {
        // One SELECT keeps the visible preferences and optimistic version consistent.
        $raw=SystemSetting::whereIn('key',['rbac_route_permissions',self::KEY])->pluck('value','key');
        $permissions=UserController::getDefaultRoutePermissions();
        if (isset($raw['rbac_route_permissions'])) {
            $stored=json_decode($raw['rbac_route_permissions'],true);
            if (!is_array($stored)) $permissions=[];
            else foreach ($stored as $path=>$roles) $permissions[$path]=is_array($roles)?array_values(array_filter($roles,'is_string')):[];
        }
        foreach ($permissions as &$roles) if (!in_array('Super Administrator',$roles,true)) array_unshift($roles,'Super Administrator');
        unset($roles);
        return ['status'=>'success','data'=>$permissions,'sidebar'=>$this->normalize(json_decode($raw[self::KEY]??'null',true)),
            'settings_version'=>hash('sha256',json_encode([$raw['rbac_route_permissions']??null,$raw[self::KEY]??null,$this->catalog()],JSON_THROW_ON_ERROR)),
            'sidebar_defaults'=>$this->defaults()];
    }

    public function lock(): void
    {
        DB::table('system_settings')->insertOrIgnore(['key'=>'navigation_settings_lock','value'=>'1','created_at'=>now(),'updated_at'=>now()]);
        DB::table('system_settings')->where('key','navigation_settings_lock')->lockForUpdate()->first();
    }
}
