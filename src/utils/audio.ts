/**
 * Synthesizes an elegant, high-clarity boutique chime for instant order arrival notification
 * Uses the Web Audio API with fallback and error tolerance.
 */
let audioCtxInstance: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtxInstance || audioCtxInstance.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtxInstance = new AudioCtxClass();
      }
    }
    if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
      audioCtxInstance.resume().catch(() => {});
    }
    return audioCtxInstance;
  } catch (e) {
    console.warn('AudioContext initialization notice:', e);
    return null;
  }
}

export function playOrderNotificationSound(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    const now = ctx.currentTime;

    // Triple chime: E5 (659Hz) -> G#5 (830Hz) -> B5 (987Hz) followed by warm shimmer E6 (1318Hz)
    const notes = [
      { freq: 659.25, time: now + 0.0, dur: 0.28, gain: 0.25 },
      { freq: 830.61, time: now + 0.14, dur: 0.32, gain: 0.28 },
      { freq: 987.77, time: now + 0.28, dur: 0.45, gain: 0.32 },
      { freq: 1318.51, time: now + 0.45, dur: 0.65, gain: 0.22 },
    ];

    notes.forEach(({ freq, time, dur, gain: noteGain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      gainNode.gain.setValueAtTime(0.0001, time);
      gainNode.gain.exponentialRampToValueAtTime(noteGain, time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(time);
      osc.stop(time + dur + 0.05);
    });

    return true;
  } catch (err) {
    console.warn('Unable to play order notification chime:', err);
    return false;
  }
}
