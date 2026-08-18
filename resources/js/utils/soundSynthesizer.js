/**
 * Web Audio API Sound Synthesizer for In-App Voice Calls
 * Generates crystal clear ringtones and call alerts with zero external audio files.
 */

let audioCtx = null;
let currentInterval = null;
let currentOscillators = [];

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function stopAllSounds() {
  if (currentInterval) {
    clearInterval(currentInterval);
    currentInterval = null;
  }
  currentOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (_) {}
  });
  currentOscillators = [];
}

/**
 * Play Incoming Call Ringtone (Pleasant melodic chime)
 */
export function playIncomingRingtone() {
  stopAllSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playChimeSequence = () => {
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, time: 0, dur: 0.15 },    // C5
      { freq: 659.25, time: 0.18, dur: 0.15 }, // E5
      { freq: 783.99, time: 0.36, dur: 0.25 }, // G5
      { freq: 1046.50, time: 0.65, dur: 0.35 },// C6
    ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.time);

      gain.gain.setValueAtTime(0, now + n.time);
      gain.gain.linearRampToValueAtTime(0.3, now + n.time + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + n.time + n.dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.time);
      osc.stop(now + n.time + n.dur);
      currentOscillators.push(osc);
    });
  };

  playChimeSequence();
  currentInterval = setInterval(playChimeSequence, 2400);
}

/**
 * Play Outgoing Ringback Tone (Classic ringing tone)
 */
export function playOutgoingRingback() {
  stopAllSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const playTone = () => {
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now); // 440 Hz
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(480, now); // 480 Hz

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.setValueAtTime(0.15, now + 1.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.3);
    osc2.stop(now + 1.3);

    currentOscillators.push(osc1, osc2);
  };

  playTone();
  currentInterval = setInterval(playTone, 3000);
}

/**
 * Play Connected Tone
 */
export function playCallConnected() {
  stopAllSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.2); // A5

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Play Call Ended Tone
 */
export function playCallEnded() {
  stopAllSounds();
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [0, 0.15, 0.3].forEach(offset => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now + offset);

    gain.gain.setValueAtTime(0.15, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.08);
  });
}
