<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreNetworkSplitterRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'node_id' => 'required|exists:network_nodes,id',
            'splitter_type' => 'required|string|max:100',
            'status' => 'required|string|in:active,inactive',
            'notes' => 'nullable|string',
        ];
    }
}
