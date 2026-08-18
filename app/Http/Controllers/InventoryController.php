<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class InventoryController extends Controller
{
    public function index()
    {
        $items = [
            [
                'id' => 1,
                'code' => 'MAT-ONT-01',
                'name' => 'ONT Huawei HG8310M GPON',
                'category' => 'Active Device',
                'unit' => 'Unit',
                'stock' => 142,
                'min_stock' => 30,
                'location' => 'Gudang Utama A-01',
                'status' => 'Available'
            ],
            [
                'id' => 2,
                'code' => 'MAT-CAB-01',
                'name' => 'Kabel Drop Core 1 Core Fiber Optik (1000m)',
                'category' => 'Cable',
                'unit' => 'Roll',
                'stock' => 18,
                'min_stock' => 5,
                'location' => 'Gudang Utama B-04',
                'status' => 'Available'
            ],
            [
                'id' => 3,
                'code' => 'MAT-SPL-08',
                'name' => 'Splitter PLC 1:8 SC/APC',
                'category' => 'Passive Device',
                'unit' => 'Pcs',
                'stock' => 64,
                'min_stock' => 20,
                'location' => 'Gudang Utama C-02',
                'status' => 'Available'
            ],
            [
                'id' => 4,
                'code' => 'MAT-FAS-01',
                'name' => 'Fast Connector SC/APC Single Mode',
                'category' => 'Accessory',
                'unit' => 'Box (100 pcs)',
                'stock' => 8,
                'min_stock' => 10,
                'location' => 'Gudang Utama C-05',
                'status' => 'Low Stock'
            ]
        ];

        return response()->json([
            'status' => 'success',
            'data' => $items
        ]);
    }
}
