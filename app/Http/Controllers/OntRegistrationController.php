<?php

namespace App\Http\Controllers;

use App\Models\OntRegistration;
use Illuminate\Http\Request;

class OntRegistrationController extends Controller
{
    public function index()
    {
        return response()->json([
            'status' => 'success',
            'data' => OntRegistration::all()
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'serial_number' => 'required|string|unique:ont_registrations',
            'vendor' => 'required|string',
            'model' => 'nullable|string',
            'customer_name' => 'nullable|string',
        ]);

        $ont = OntRegistration::create($validated);
        return response()->json(['status' => 'success', 'data' => $ont], 201);
    }

    public function show($id)
    {
        $ont = OntRegistration::findOrFail($id);
        return response()->json(['status' => 'success', 'data' => $ont]);
    }

    public function update(Request $request, $id)
    {
        $ont = OntRegistration::findOrFail($id);
        $ont->update($request->all());
        return response()->json(['status' => 'success', 'data' => $ont]);
    }

    public function destroy($id)
    {
        $ont = OntRegistration::findOrFail($id);
        $ont->delete();
        return response()->json(['status' => 'success', 'message' => 'ONT registration deleted']);
    }
}
