<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BillingPayment extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'billing_invoice_id',
        'payment_date',
        'amount',
        'payment_method',
        'notes',
    ];

    /**
     * The invoice this payment belongs to.
     */
    public function invoice()
    {
        return $this->belongsTo(BillingInvoice::class, 'billing_invoice_id');
    }
}
