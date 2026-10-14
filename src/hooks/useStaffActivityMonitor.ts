import { useEffect, useRef } from 'react';
import { useStore } from '../context/StoreContext';

/**
 * Monitors staff device activity (mouse, keyboard, touch, scroll)
 * and marks staff member as idle after 15 minutes of inactivity.
 */
export function useStaffActivityMonitor() {
  const {
    currentUser,
    settings,
    setStaffIdleStatus,
    updateStaffActivity,
  } = useStore();

  const isStaff = currentUser?.type === 'staff';
  const staffId = currentUser?.staffId;
  const isEnabled = settings.staffIdleAlert?.enabled !== false;
  const idleThresholdMinutes = settings.staffIdleAlert?.idleThresholdMinutes || 15;
  const idleThresholdMs = idleThresholdMinutes * 60 * 1000;

  const lastActivityRef = useRef<number>(Date.now());
  const isCurrentlyIdleRef = useRef<boolean>(false);
  const throttleTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!isStaff || !staffId || !isEnabled) {
      return;
    }

    lastActivityRef.current = Date.now();
    isCurrentlyIdleRef.current = false;

    const handleUserActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;

      // If user was previously idle, wake up immediately
      if (isCurrentlyIdleRef.current) {
        isCurrentlyIdleRef.current = false;
        setStaffIdleStatus(staffId, false);
      }

      // Throttle heartbeat updates to once every 2 minutes
      if (!throttleTimeoutRef.current) {
        throttleTimeoutRef.current = setTimeout(() => {
          updateStaffActivity(staffId);
          throttleTimeoutRef.current = null;
        }, 120000);
      }
    };

    // Attach activity listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Check for 15-minute idle threshold every 15 seconds
    const interval = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;

      if (idleTime >= idleThresholdMs && !isCurrentlyIdleRef.current) {
        isCurrentlyIdleRef.current = true;
        setStaffIdleStatus(staffId, true);
      }
    }, 15000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      clearInterval(interval);
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, [isStaff, staffId, isEnabled, idleThresholdMs]);
}
