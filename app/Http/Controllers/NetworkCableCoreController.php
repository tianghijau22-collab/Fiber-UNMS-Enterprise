<?php

namespace App\Http\Controllers;

use App\Models\NetworkCableCore;
use App\Http\Requests\StoreNetworkCableCoreRequest;
use App\Http\Requests\UpdateNetworkCableCoreRequest;
use App\Http\Resources\NetworkCableCoreResource;
use Illuminate\Http\Response;

class NetworkCableCoreController extends Controller
{
    public function index()
    {
        $cores = NetworkCableCore::paginate(20);
        return NetworkCableCoreResource::collection($cores);
    }

    public function store(StoreNetworkCableCoreRequest $request)
    {
        $core = NetworkCableCore::create($request->validated());
        return new NetworkCableCoreResource($core);
    }

    public function show(NetworkCableCore $networkCableCore)
    {
        return new NetworkCableCoreResource($networkCableCore);
    }

    public function update(UpdateNetworkCableCoreRequest $request, NetworkCableCore $networkCableCore)
    {
        $networkCableCore->update($request->validated());
        return new NetworkCableCoreResource($networkCableCore);
    }

    public function destroy(NetworkCableCore $networkCableCore)
    {
        $networkCableCore->delete();
        return response(null, Response::HTTP_NO_CONTENT);
    }
}
