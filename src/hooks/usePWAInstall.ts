import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level cache so beforeinstallprompt is never lost if fired prior to React mount
let capturedInstallPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<(prompt: BeforeInstallPromptEvent | null) => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedInstallPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn(capturedInstallPrompt));
  });

  window.addEventListener('appinstalled', () => {
    capturedInstallPrompt = null;
    promptListeners.forEach((fn) => fn(null));
  });
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    capturedInstallPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // 1. Detect standalone display mode (already installed on phone or desktop)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
      document.referrer.includes('android-app://');
    setIsInstalled(isStandalone);

    // 2. Detect platform & environment
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(userAgent);
    const android = /android/.test(userAgent);
    setIsIOS(iOS);
    setIsAndroid(android);

    // Detect if running within an iframe (e.g. AI Studio development preview)
    const inIframe = window.self !== window.top;
    setIsInIframe(inIframe);

    // 3. Subscribe to prompt updates
    const onPromptChange = (prompt: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(prompt);
    };
    promptListeners.add(onPromptChange);

    // If prompt was already captured prior to mount, sync it
    if (capturedInstallPrompt && !deferredPrompt) {
      setDeferredPrompt(capturedInstallPrompt);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      capturedInstallPrompt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(capturedInstallPrompt);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      capturedInstallPrompt = null;
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptListeners.delete(onPromptChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<{ success: boolean; outcome?: 'accepted' | 'dismissed' }> => {
    const prompt = deferredPrompt || capturedInstallPrompt;
    if (!prompt) {
      return { success: false };
    }

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        capturedInstallPrompt = null;
        setDeferredPrompt(null);
        return { success: true, outcome: 'accepted' };
      }
      return { success: false, outcome: 'dismissed' };
    } catch (err) {
      console.warn('PWA install prompt error:', err);
      return { success: false };
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt || capturedInstallPrompt),
    hasPromptReady: Boolean(deferredPrompt || capturedInstallPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    isInIframe,
    install,
  };
}
