import { useEffect, useRef, useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';

/**
 * Hook to manage staff activity, 15-minute idle detection, and admin intimation
 */
export function useStaffIdleTracker() {
  const {
    currentUser,
    staffMembers,
    settings,
    updateStaffIdleStatus,
  } = useStore();

  const isStaff = currentUser?.type === 'staff';
  const isAdmin = currentUser?.type === 'admin';
  const currentStaffId = currentUser?.staffId;

  const isIdleAlertEnabled = settings.staffIdleAlert?.enabled ?? true;
  const idleThresholdMinutes = settings.staffIdleAlert?.idleThresholdMinutes ?? 15;
  const idleThresholdMs = idleThresholdMinutes * 60 * 1000;

  const lastActivityRef = useRef<number>(Date.now());
  const isIdleReportedRef = useRef<boolean>(false);
  const [localIsIdle, setLocalIsIdle] = useState(false);

  // Monitor user activity events when logged in as staff
  useEffect(() => {
    if (!isStaff || !currentStaffId || !isIdleAlertEnabled) {
      return;
    }

    lastActivityRef.current = Date.now();
    isIdleReportedRef.current = false;
    setLocalIsIdle(false);

    const onUserActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;

      // If staff was marked idle, resume them on interaction
      if (isIdleReportedRef.current) {
        isIdleReportedRef.current = false;
        setLocalIsIdle(false);
        updateStaffIdleStatus(currentStaffId, false).catch(() => {});
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, onUserActivity, { passive: true });
    });

    // Interval to check inactivity every 15 seconds
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= idleThresholdMs) {
        if (!isIdleReportedRef.current) {
          isIdleReportedRef.current = true;
          setLocalIsIdle(true);
          updateStaffIdleStatus(currentStaffId, true).catch(() => {});
        }
      }
    }, 15000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, onUserActivity);
      });
      clearInterval(interval);
    };
  }, [isStaff, currentStaffId, isIdleAlertEnabled, idleThresholdMs, updateStaffIdleStatus]);

  // For Admin: Calculate idle staff currently logged in
  const idleStaffMembers = useMemo(() => {
    if (!isIdleAlertEnabled) return [];
    return (staffMembers || []).filter(
      (s) => s.isLoggedIn && s.isIdle
    );
  }, [staffMembers, isIdleAlertEnabled]);

  const hasIdleStaff = idleStaffMembers.length > 0;

  return {
    isStaff,
    isAdmin,
    localIsIdle,
    idleStaffMembers,
    hasIdleStaff,
    isIdleAlertEnabled,
    idleThresholdMinutes,
  };
}
