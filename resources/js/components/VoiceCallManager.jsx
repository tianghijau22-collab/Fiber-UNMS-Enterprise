import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  playIncomingRingtone,
  playOutgoingRingback,
  playCallConnected,
  playCallEnded,
  stopAllSounds,
} from '../utils/soundSynthesizer';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function VoiceCallManager({ currentUser }) {
  // Call States: 'idle' | 'outgoing' | 'incoming' | 'connected' | 'ended'
  const [callState, setCallState] = useState('idle');
  const [activeCallId, setActiveCallId] = useState(null);
  const [peerInfo, setPeerInfo] = useState(null); // { id, name, role, division, phone }
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const durationTimerRef = useRef(null);
  const processedIceRef = useRef(new Set());
  const isCallerRef = useRef(false);

  // ── Helper: Format Duration (MM:SS) ──────────────────────────────────────────
  const formatDuration = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // ── Helper: Cleanup Peer Connection & Streams ────────────────────────────────
  const cleanupCall = useCallback(() => {
    stopAllSounds();
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    processedIceRef.current.clear();
    setCallDuration(0);
    setIsMuted(false);
  }, []);

  // ── End or Reject Call ───────────────────────────────────────────────────────
  const endCall = useCallback(async (action = 'ended') => {
    playCallEnded();
    if (activeCallId) {
      try {
        await fetch(`/api/calls/${activeCallId}/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
      } catch (_) {}
    }
    cleanupCall();
    setCallState('ended');
    setTimeout(() => {
      setCallState('idle');
      setActiveCallId(null);
      setPeerInfo(null);
    }, 1500);
  }, [activeCallId, cleanupCall]);

  // ── Send ICE Candidate to Server ────────────────────────────────────────────
  const sendIceCandidate = useCallback(async (callId, candidate, role) => {
    try {
      await fetch(`/api/calls/${callId}/ice-candidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate, role }),
      });
    } catch (_) {}
  }, []);

  // ── Setup Peer Connection & Audio Stream ────────────────────────────────────
  const createPeerConnection = useCallback((callId, role) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendIceCandidate(callId, event.candidate, role);
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        endCall('ended');
      }
    };

    return pc;
  }, [sendIceCandidate, endCall]);

  // ── Start Call Duration Timer ───────────────────────────────────────────────
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  // ── Initiate Call (Caller) ──────────────────────────────────────────────────
  const startCall = useCallback(async (receiver) => {
    try {
      setErrorMessage(null);
      setPeerInfo(receiver);
      setCallState('outgoing');
      isCallerRef.current = true;
      playOutgoingRingback();

      // 1. Get User Audio
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // 2. Setup WebRTC PeerConnection
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3. Create Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 4. Send Offer to Server
      const res = await fetch('/api/calls/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiver_id: receiver.id,
          sdp_offer: JSON.stringify(offer),
          current_user_id: currentUser?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.call) {
        throw new Error(data.message || 'Gagal memulai panggilan.');
      }

      const callId = data.call.id;
      setActiveCallId(callId);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendIceCandidate(callId, event.candidate, 'caller');
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
      };

      // 5. Poll for Answer & Receiver ICE Candidates
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/calls/${callId}/poll`);
          const pollData = await pollRes.json();

          if (pollData.status === 'rejected' || pollData.status === 'ended' || pollData.status === 'missed') {
            endCall(pollData.status);
            return;
          }

          // If answered & SDP Answer received
          if (pollData.status === 'in_call' && pollData.sdp_answer && !pc.currentRemoteDescription) {
            const answerDesc = new RTCSessionDescription(JSON.parse(pollData.sdp_answer));
            await pc.setRemoteDescription(answerDesc);
            playCallConnected();
            setCallState('connected');
            startDurationTimer();
          }

          // Process receiver ICE candidates
          if (pollData.receiver_ice && Array.isArray(pollData.receiver_ice)) {
            for (const cand of pollData.receiver_ice) {
              const candKey = JSON.stringify(cand);
              if (!processedIceRef.current.has(candKey) && pc.remoteDescription) {
                processedIceRef.current.add(candKey);
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }, 1500);

    } catch (err) {
      stopAllSounds();
      cleanupCall();
      setErrorMessage(err.message || 'Tidak dapat mengakses mikrofon.');
      setCallState('idle');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  }, [currentUser, sendIceCandidate, endCall, startDurationTimer, cleanupCall]);

  // ── Answer Call (Receiver) ──────────────────────────────────────────────────
  const answerCall = useCallback(async () => {
    if (!activeCallId) return;
    try {
      stopAllSounds();
      isCallerRef.current = false;

      // 1. Fetch Call Detail for SDP Offer
      const pollRes = await fetch(`/api/calls/${activeCallId}/poll`);
      const pollData = await pollRes.json();

      if (!pollData.sdp_offer) {
        throw new Error('Panggilan dibatalkan oleh penelepon.');
      }

      // 2. Get User Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      // 3. Create WebRTC PeerConnection
      const pc = createPeerConnection(activeCallId, 'receiver');
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 4. Set Remote Description (Offer)
      const offerDesc = new RTCSessionDescription(JSON.parse(pollData.sdp_offer));
      await pc.setRemoteDescription(offerDesc);

      // 5. Create Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // 6. Send Answer to Server
      await fetch(`/api/calls/${activeCallId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp_answer: JSON.stringify(answer),
        }),
      });

      playCallConnected();
      setCallState('connected');
      startDurationTimer();

      // 7. Poll for Caller ICE Candidates & Call State
      pollIntervalRef.current = setInterval(async () => {
        try {
          const pollStatusRes = await fetch(`/api/calls/${activeCallId}/poll`);
          const statusData = await pollStatusRes.json();

          if (statusData.status === 'ended' || statusData.status === 'rejected') {
            endCall('ended');
            return;
          }

          if (statusData.caller_ice && Array.isArray(statusData.caller_ice)) {
            for (const cand of statusData.caller_ice) {
              const candKey = JSON.stringify(cand);
              if (!processedIceRef.current.has(candKey) && pc.remoteDescription) {
                processedIceRef.current.add(candKey);
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(cand));
                } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }, 1500);

    } catch (err) {
      stopAllSounds();
      cleanupCall();
      setErrorMessage(err.message || 'Gagal menjawab panggilan.');
      setCallState('idle');
      setTimeout(() => setErrorMessage(null), 4000);
    }
  }, [activeCallId, createPeerConnection, startDurationTimer, endCall, cleanupCall]);

  // ── Mute / Unmute Microphone ────────────────────────────────────────────────
  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  // ── Background Poll for Incoming Calls (when idle) ──────────────────────────
  useEffect(() => {
    if (callState !== 'idle') return;

    let isRequesting = false;
    const checkInterval = setInterval(async () => {
      if (document.hidden || isRequesting) return;
      isRequesting = true;
      try {
        const res = await fetch(`/api/calls/check-incoming?current_user_id=${currentUser?.id || 1}`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.call && data.call.status === 'ringing') {
          setActiveCallId(data.call.id);
          setPeerInfo(data.call.caller);
          setCallState('incoming');
          playIncomingRingtone();
        }
      } catch (_) {
      } finally {
        isRequesting = false;
      }
    }, 8000);

    return () => clearInterval(checkInterval);
  }, [callState, currentUser]);

  // ── Global Event Listener: fiber:call-user ──────────────────────────────────
  useEffect(() => {
    const handleGlobalCall = (e) => {
      if (e.detail && e.detail.user) {
        startCall(e.detail.user);
      }
    };
    window.addEventListener('fiber:call-user', handleGlobalCall);
    return () => window.removeEventListener('fiber:call-user', handleGlobalCall);
  }, [startCall]);

  // Clean up on component unmount
  useEffect(() => {
    return () => cleanupCall();
  }, [cleanupCall]);

  return (
    <>
      {/* Hidden Audio Player for Remote Stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Error Toast Notification */}
      {errorMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] bg-rose-600 text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold flex items-center gap-2">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* ── 1. INCOMING CALL MODAL ───────────────────────────────────────────── */}
      {callState === 'incoming' && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-xl p-6 w-full max-w-sm text-center shadow-2xl space-y-6">
            <div className="relative inline-block mx-auto">
              <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-neutral-900 border-2 border-blue-500 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-extrabold shadow-lg animate-bounce">
                📞
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500"></span>
              </span>
            </div>

            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 dark:bg-neutral-900 text-blue-700 dark:text-blue-400">
                Panggilan Suara Masuk
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 font-sans">
                {peerInfo?.name || 'Pengguna UNMS'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {peerInfo?.role || 'Staff'} · Divisi {peerInfo?.division || 'Teknis'}
              </p>
            </div>

            {/* Accept & Reject Buttons */}
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={() => endCall('rejected')}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>✕ Tolak</span>
              </button>
              <button
                onClick={answerCall}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 animate-pulse"
              >
                <span>📞 Terima</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. OUTGOING CALL MODAL ───────────────────────────────────────────── */}
      {callState === 'outgoing' && (
        <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-black border border-slate-200 dark:border-[#3f3f46] rounded-xl p-6 w-full max-w-sm text-center shadow-2xl space-y-6">
            <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-neutral-900 border-2 border-blue-500/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-3xl font-extrabold mx-auto animate-pulse">
              📡
            </div>

            <div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-slate-400">
                Memanggil Lawan Bicara...
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-2 font-sans">
                {peerInfo?.name || 'Pengguna'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {peerInfo?.role || 'Staff'} · {peerInfo?.phone || ''}
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => endCall('ended')}
                className="w-full py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>⏹️ Batalkan Panggilan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 3. ACTIVE IN-CALL FLOATING BAR / MODAL ───────────────────────────── */}
      {callState === 'connected' && (
        <div className="fixed bottom-5 right-5 z-[150] bg-white dark:bg-black border-2 border-emerald-500 rounded-xl p-4 shadow-2xl w-80 animate-fade-in space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-500 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                🎙️
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate font-sans">
                  {peerInfo?.name || 'Panggilan Terhubung'}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {formatDuration(callDuration)}
                  </span>
                </div>
              </div>
            </div>

            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
              Live
            </span>
          </div>

          {/* Controls: Mute, Speaker, Hangup */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-[#222222]">
            <button
              onClick={toggleMute}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 border ${
                isMuted
                  ? 'bg-amber-500 text-white border-amber-600'
                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#3f3f46]'
              }`}
            >
              <span>{isMuted ? '🔇 Unmute' : '🎤 Mute'}</span>
            </button>

            <button
              onClick={() => endCall('ended')}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <span>🔴 Tutup</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 4. CALL ENDED NOTIFICATION ───────────────────────────────────────── */}
      {callState === 'ended' && (
        <div className="fixed bottom-5 right-5 z-[150] bg-slate-900 text-white border border-slate-700 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-2 text-xs font-semibold animate-fade-in">
          <span>📞 Panggilan telah berakhir.</span>
        </div>
      )}
    </>
  );
}
