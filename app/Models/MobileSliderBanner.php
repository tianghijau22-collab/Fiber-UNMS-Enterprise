<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MobileSliderBanner extends Model
{
    use HasFactory;

    protected $table = 'mobile_slider_banners';

    protected $fillable = [
        'title',
        'subtitle',
        'image_url',
        'badge_text',
        'action_type',
        'action_url',
        'is_active',
        'sort_order',
        'created_by',
        'created_by_name',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'sort_order' => 'integer',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
