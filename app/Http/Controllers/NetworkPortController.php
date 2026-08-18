<?php

namespace App\Http\Controllers;

use App\Models\NetworkPort;
use App\Http\Requests\StoreNetworkPortRequest;
use App\Http\Requests\UpdateNetworkPortRequest;
use App\Http\Resources\NetworkPortResource;
use Illuminate\Http\Response;

class NetworkPortController extends Controller
{
    public function index()
    {
        $ports = NetworkPort::paginate(20);
        return NetworkPortResource::collection($ports);
    }

    public function store(StoreNetworkPortRequest $request)
    {
        $port = NetworkPort::create($request->validated());
        return new NetworkPortResource($port);
    }

    public function show(NetworkPort $networkPort)
    {
        return new NetworkPortResource($networkPort);
    }

    public function update(UpdateNetworkPortRequest $request, NetworkPort $networkPort)
    {
        $networkPort->update($request->validated());
        return new NetworkPortResource($networkPort);
    }

    public function destroy(NetworkPort $networkPort)
    {
        $networkPort->delete();
        return response(null, Response::HTTP_NO_CONTENT);
    }
}
