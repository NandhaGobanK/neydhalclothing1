/**
 * Comprehensive device notification manager for Live Chat & Real-Time Orders
 * Handles:
 * 1. Physical device vibration (Haptic feedback API: navigator.vibrate)
 * 2. HTML5 Web / PWA Push Notification API (with ServiceWorker and standard Notification fallback)
 * 3. Window focus and direct interaction on notification tap
 * 4. Web Audio API chime orchestration
 */
import { playChatChimeSound } from './audio';

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export interface DeviceNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  badge?: string;
  sound?: boolean;
  isCustomer?: boolean;
  vibrate?: number[];
  onClick?: () => void;
}

/**
 * Checks current notification permission state
 */
export function getNotificationPermission(): NotificationPermissionStatus {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionStatus;
}

/**
 * Prompts user for device notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.warn('Error requesting notification permission:', err);
    return false;
  }
}

/**
 * Triggers hardware vibration on mobile and supported devices
 */
export function triggerDeviceVibration(pattern: number[] = [150, 75, 150]): boolean {
  if (typeof window === 'undefined' || !('navigator' in window)) return false;
  try {
    if (typeof navigator.vibrate === 'function') {
      return navigator.vibrate(pattern);
    }
  } catch (e) {
    // Vibration can be ignored if device doesn't support or user interacted
  }
  return false;
}

/**
 * Dispatches an alert across the user's device:
 * - Plays high-clarity synthesized Web Audio chime
 * - Triggers physical haptic vibration
 * - Shows native system/lockscreen notification if permitted
 */
export async function sendDeviceNotification(options: DeviceNotificationOptions): Promise<boolean> {
  const {
    title,
    body,
    icon = '/pwa-192x192.png',
    tag,
    badge = '/icon.svg',
    sound = true,
    isCustomer = false,
    vibrate = isCustomer ? [180, 80, 180] : [220, 100, 220],
    onClick,
  } = options;

  // 1. Play synthesized chat audio chime
  if (sound) {
    playChatChimeSound(isCustomer);
  }

  // 2. Trigger device haptic vibration
  triggerDeviceVibration(vibrate);

  if (typeof window === 'undefined') return false;

  // 3. Dispatch Native Web Notification if supported and granted
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Prefer Service Worker registration for PWA and mobile Android background wakeups
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        try {
          const reg = await navigator.serviceWorker.ready;
          await reg.showNotification(title, {
            body,
            icon,
            badge,
            tag: tag || `chat-${Date.now()}`,
            vibrate,
            renotify: true,
            data: { url: window.location.href },
          } as any);
          return true;
        } catch {
          // Fall through to standard Notification
        }
      }

      // Standard desktop/window Notification fallback
      const notification = new Notification(title, {
        body,
        icon,
        tag: tag || `chat-${Date.now()}`,
      });

      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        if (onClick) {
          onClick();
        }
        notification.close();
      };

      return true;
    } catch (e) {
      console.warn('Device notification dispatch note:', e);
    }
  }

  return false;
}
