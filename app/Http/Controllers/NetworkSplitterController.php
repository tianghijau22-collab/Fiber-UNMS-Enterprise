<?php

namespace App\Http\Controllers;

use App\Models\NetworkSplitter;
use App\Http\Requests\StoreNetworkSplitterRequest;
use App\Http\Requests\UpdateNetworkSplitterRequest;
use App\Http\Resources\NetworkSplitterResource;
use Illuminate\Http\Response;

class NetworkSplitterController extends Controller
{
    public function index()
    {
        $splitters = NetworkSplitter::paginate(20);
        return NetworkSplitterResource::collection($splitters);
    }

    public function store(StoreNetworkSplitterRequest $request)
    {
        $splitter = NetworkSplitter::create($request->validated());
        return new NetworkSplitterResource($splitter);
    }

    public function show(NetworkSplitter $networkSplitter)
    {
        return new NetworkSplitterResource($networkSplitter);
    }

    public function update(UpdateNetworkSplitterRequest $request, NetworkSplitter $networkSplitter)
    {
        $networkSplitter->update($request->validated());
        return new NetworkSplitterResource($networkSplitter);
    }

    public function destroy(NetworkSplitter $networkSplitter)
    {
        $networkSplitter->delete();
        return response(null, Response::HTTP_NO_CONTENT);
    }
}
