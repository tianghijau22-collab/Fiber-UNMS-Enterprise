<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class BillingController extends Controller
{
    public function index()
    {
        $invoices = [
            [
                'invoice_number' => 'INV-202608-001',
                'customer' => 'Budi Santoso',
                'package' => 'Home Fiber 50Mbps',
                'amount' => 350000,
                'due_date' => '2026-08-10',
                'status' => 'Paid',
                'paid_at' => '2026-08-02 09:14'
            ],
            [
                'invoice_number' => 'INV-202608-002',
                'customer' => 'Siti Rahma',
                'package' => 'Home Fiber 30Mbps',
                'amount' => 250000,
                'due_date' => '2026-08-10',
                'status' => 'Unpaid',
                'paid_at' => null
            ],
            [
                'invoice_number' => 'INV-202608-003',
                'customer' => 'PT Maju Bersama',
                'package' => 'Enterprise Dedicated 200Mbps',
                'amount' => 2500000,
                'due_date' => '2026-08-05',
                'status' => 'Paid',
                'paid_at' => '2026-08-01 14:30'
            ],
            [
                'invoice_number' => 'INV-202607-089',
                'customer' => 'Ahmad Dahlan',
                'package' => 'Home Fiber 20Mbps',
                'amount' => 180000,
                'due_date' => '2026-07-20',
                'status' => 'Overdue / Isolated',
                'paid_at' => null
            ]
        ];

        return response()->json([
            'status' => 'success',
            'data' => $invoices
        ]);
    }
}
