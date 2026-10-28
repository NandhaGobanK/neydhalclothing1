import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

/**
 * Determines device category based on navigator.userAgent and touch indicators.
 * Used for device-adaptive UPI payment flows (native UPI intent vs QR vs fallback).
 */
export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined' || !navigator) return 'desktop';
  const ua = (navigator.userAgent || '').toLowerCase();

  // iPad & Tablet checks (including iPadOS where userAgent can appear as MacIntel)
  const isIPad =
    /ipad/.test(ua) ||
    (typeof navigator.platform === 'string' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);

  const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua);
  const isGenericTablet = /tablet|playbook|silk/.test(ua);

  if (isIPad || isAndroidTablet || isGenericTablet) {
    return 'tablet';
  }

  // Mobile phone checks
  const isMobile =
    /mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/.test(ua);

  if (isMobile) {
    return 'mobile';
  }

  return 'desktop';
}

/**
 * React hook to reactively track device category
 */
export function useDeviceType(): DeviceType {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => getDeviceType());

  useEffect(() => {
    const handleResizeOrChange = () => {
      setDeviceType(getDeviceType());
    };

    window.addEventListener('resize', handleResizeOrChange);
    return () => window.removeEventListener('resize', handleResizeOrChange);
  }, []);

  return deviceType;
}
