<?php

namespace App\Http\Controllers;

use App\Models\VoiceCall;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;

class CallController extends Controller
{
    /**
     * Get current user (either from auth or fallback to first user for dev/testing)
     */
    private function getCurrentUser(Request $request)
    {
        return auth()->user() ?? User::find($request->input('current_user_id', 1)) ?? User::first();
    }

    /**
     * Get list of users available for calling
     */
    public function directory(Request $request)
    {
        $user = $this->getCurrentUser($request);
        $currentUserId = $user ? $user->id : 0;

        $users = User::whereIn('status', ['Active', 'active'])
            ->where('id', '!=', $currentUserId)
            ->select('id', 'name', 'username', 'role', 'division', 'phone', 'last_login_at', 'updated_at')
            ->orderBy('name', 'asc')
            ->get()
            ->map(function ($u) {
                // Determine online state based on activity in the last 15 minutes
                $lastActive = $u->updated_at ?? $u->last_login_at;
                $isOnline = $lastActive && Carbon::parse($lastActive)->gt(now()->subMinutes(15));
                return [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'role' => $u->role,
                    'division' => $u->division,
                    'phone' => $u->phone,
                    'is_online' => (bool) $isOnline,
                ];
            });

        return response()->json([
            'status' => 'success',
            'users' => $users,
        ]);
    }

    /**
     * Initiate a new voice call (Caller sends SDP Offer)
     */
    public function initiate(Request $request)
    {
        $request->validate([
            'receiver_id' => 'required|exists:users,id',
            'sdp_offer' => 'required|string',
        ]);

        $caller = $this->getCurrentUser($request);
        if (!$caller) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($caller->id == $request->receiver_id) {
            return response()->json(['message' => 'Tidak dapat menelepon diri sendiri.'], 422);
        }

        // Cancel previous stale ringing calls
        VoiceCall::where(function ($q) use ($caller, $request) {
            $q->where('caller_id', $caller->id)
              ->orWhere('receiver_id', $request->receiver_id);
        })->where('status', 'ringing')
          ->where('created_at', '<', now()->subSeconds(60))
          ->update(['status' => 'missed', 'ended_at' => now()]);

        $call = VoiceCall::create([
            'caller_id' => $caller->id,
            'receiver_id' => $request->receiver_id,
            'status' => 'ringing',
            'sdp_offer' => $request->sdp_offer,
            'caller_ice' => $request->input('caller_ice', []),
            'receiver_ice' => [],
        ]);

        return response()->json([
            'status' => 'success',
            'call' => $call->load(['caller', 'receiver']),
        ]);
    }

    /**
     * Check for incoming calls for the current user
     */
    public function checkIncoming(Request $request)
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return response()->json(['call' => null]);
        }

        // Update user activity timestamp
        $user->touch();

        $call = VoiceCall::where('receiver_id', $user->id)
            ->where('status', 'ringing')
            ->where('created_at', '>=', now()->subSeconds(45))
            ->with(['caller' => function ($q) {
                $q->select('id', 'name', 'role', 'division', 'phone');
            }])
            ->latest()
            ->first();

        return response()->json([
            'call' => $call,
        ]);
    }

    /**
     * Answer incoming call (Receiver sends SDP Answer)
     */
    public function answer(Request $request, $id)
    {
        $request->validate([
            'sdp_answer' => 'required|string',
        ]);

        $call = VoiceCall::findOrFail($id);
        if ($call->status !== 'ringing') {
            return response()->json(['message' => 'Panggilan sudah tidak aktif.'], 400);
        }

        $call->update([
            'status' => 'in_call',
            'sdp_answer' => $request->sdp_answer,
            'started_at' => now(),
        ]);

        return response()->json([
            'status' => 'success',
            'call' => $call->load(['caller', 'receiver']),
        ]);
    }

    /**
     * Send ICE candidate
     */
    public function sendIceCandidate(Request $request, $id)
    {
        $request->validate([
            'candidate' => 'required',
            'role' => 'required|in:caller,receiver',
        ]);

        $call = VoiceCall::findOrFail($id);
        $field = $request->role === 'caller' ? 'caller_ice' : 'receiver_ice';
        
        $current = $call->$field ?? [];
        $current[] = $request->candidate;
        
        $call->update([
            $field => $current,
        ]);

        return response()->json(['status' => 'success']);
    }

    /**
     * Poll active call status, partner ICE candidates, and answer
     */
    public function poll(Request $request, $id)
    {
        $call = VoiceCall::with(['caller', 'receiver'])->find($id);
        if (!$call) {
            return response()->json(['status' => 'ended', 'call' => null]);
        }

        return response()->json([
            'status' => $call->status,
            'sdp_offer' => $call->sdp_offer,
            'sdp_answer' => $call->sdp_answer,
            'caller_ice' => $call->caller_ice ?? [],
            'receiver_ice' => $call->receiver_ice ?? [],
            'started_at' => $call->started_at,
            'duration_seconds' => $call->duration_seconds,
        ]);
    }

    /**
     * End, reject, or cancel a call
     */
    public function endCall(Request $request, $id)
    {
        $call = VoiceCall::find($id);
        if (!$call) {
            return response()->json(['status' => 'ended']);
        }

        $targetStatus = $request->input('action', 'ended'); // ended, rejected, missed
        $duration = 0;
        if ($call->started_at) {
            $duration = (int) Carbon::parse($call->started_at)->diffInSeconds(now());
        }

        $call->update([
            'status' => $targetStatus,
            'ended_at' => now(),
            'duration_seconds' => $duration,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Panggilan diakhiri.',
            'duration_seconds' => $duration,
        ]);
    }

    /**
     * Get recent call logs
     */
    public function history(Request $request)
    {
        $user = $this->getCurrentUser($request);
        if (!$user) {
            return response()->json(['history' => []]);
        }

        $history = VoiceCall::where(function ($q) use ($user) {
            $q->where('caller_id', $user->id)
              ->orWhere('receiver_id', $user->id);
        })
        ->with(['caller:id,name,role,division', 'receiver:id,name,role,division'])
        ->latest()
        ->limit(20)
        ->get();

        return response()->json([
            'history' => $history,
        ]);
    }
}
