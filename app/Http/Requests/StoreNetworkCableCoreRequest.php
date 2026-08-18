<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNetworkCableCoreRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'cable_id' => 'required|exists:network_cables,id',
            'core_number' => 'required|integer|min:1',
            'status' => 'required|string|in:free,occupied',
            'notes' => 'nullable|string',
        ];
    }
}
