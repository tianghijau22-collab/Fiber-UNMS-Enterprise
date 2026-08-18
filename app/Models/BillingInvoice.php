<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BillingInvoice extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'customer_service_id',
        'invoice_number',
        'amount',
        'billing_period_start',
        'billing_period_end',
        'due_date',
        'status',
    ];

    protected $casts = [
        'billing_period_start' => 'date',
        'billing_period_end'   => 'date',
        'due_date'             => 'date',
        'amount'               => 'decimal:2',
    ];

    public function customerService()
    {
        return $this->belongsTo(CustomerService::class);
    }

    public function payments()
    {
        return $this->hasMany(BillingPayment::class, 'billing_invoice_id');
    }
}
