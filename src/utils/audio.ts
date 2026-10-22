/**
 * Synthesizes an elegant, high-clarity boutique chime for instant order arrival notification
 * Uses the Web Audio API with fallback and error tolerance.
 */
let audioCtxInstance: AudioContext | null = null;

// Auto-unlock AudioContext on first user touch/click on device
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    try {
      if (audioCtxInstance && audioCtxInstance.state === 'suspended') {
        audioCtxInstance.resume().catch(() => {});
      } else if (!audioCtxInstance) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          audioCtxInstance = new AudioCtxClass();
        }
      }
    } catch {}
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
}

export function resumeAudioContext(): void {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch {}
}

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

/**
 * Synthesizes an elegant, distinct dual/triple chime for real-time live chat messages.
 * @param forCustomer true if recipient is customer (warmer tone), false if staff (snappier alert)
 */
export function playChatChimeSound(forCustomer: boolean = false): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    const now = ctx.currentTime;

    if (forCustomer) {
      // Warm, welcoming concierge chime: F5 (698Hz) -> A5 (880Hz) -> C6 (1046Hz)
      const notes = [
        { freq: 698.46, time: now + 0.0, dur: 0.22, gain: 0.26 },
        { freq: 880.0, time: now + 0.12, dur: 0.28, gain: 0.28 },
        { freq: 1046.5, time: now + 0.26, dur: 0.45, gain: 0.32 },
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
    } else {
      // Crisp staff triage ping: G5 (784Hz) -> D6 (1174Hz)
      const notes = [
        { freq: 783.99, time: now + 0.0, dur: 0.18, gain: 0.28 },
        { freq: 1174.66, time: now + 0.12, dur: 0.35, gain: 0.32 },
      ];

      notes.forEach(({ freq, time, dur, gain: noteGain }) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gainNode.gain.setValueAtTime(0.0001, time);
        gainNode.gain.exponentialRampToValueAtTime(noteGain, time + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + dur);

        osc.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc.start(time);
        osc.stop(time + dur + 0.05);
      });
    }

    return true;
  } catch (err) {
    console.warn('Unable to play chat notification sound:', err);
    return false;
  }
}

/**
 * Synthesizes an uplifting, sparkling chime for real-time saree restock notification
 * Notes: C5 (523Hz) -> E5 (659Hz) -> G5 (784Hz) -> C6 (1046Hz) with bright harmonics
 */
export function playRestockNotificationSound(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, time: now + 0.0, dur: 0.22, gain: 0.22 },
      { freq: 659.25, time: now + 0.12, dur: 0.26, gain: 0.25 },
      { freq: 783.99, time: now + 0.24, dur: 0.35, gain: 0.28 },
      { freq: 1046.5, time: now + 0.38, dur: 0.55, gain: 0.32 },
    ];

    notes.forEach(({ freq, time, dur, gain: noteGain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
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
    console.warn('Unable to play restock chime:', err);
    return false;
  }
}

/**
 * Dispatches real-time Web & PWA push notifications with sound when products are restocked
 */
export async function sendRestockPushNotification(productTitles: string[], categoryName?: string): Promise<void> {
  // 1. Play real-time notification chime
  playRestockNotificationSound();

  if (typeof window === 'undefined') return;

  const title = '✨ Fresh Saree Restocked!';
  const itemsText = productTitles.length > 0 ? productTitles.join(', ') : 'Exclusive Saree Handlooms';
  const body = categoryName
    ? `"${itemsText}" in ${categoryName} is back in stock! Tap to view live inventory.`
    : `"${itemsText}" has been restocked in live inventory! Tap to view now.`;

  // 2. Browser / PWA Notification API
  if ('Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          try {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification(title, {
              body,
              icon: '/pwa-192x192.png',
              badge: '/icon.svg',
              tag: `restock-${Date.now()}`,
            });
            return;
          } catch {}
        }
        new Notification(title, {
          body,
          icon: '/pwa-192x192.png',
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((perm) => {
          if (perm === 'granted') {
            new Notification(title, {
              body,
              icon: '/pwa-192x192.png',
            });
          }
        });
      }
    } catch (e) {
      console.warn('Push notification delivery note:', e);
    }
  }
}

