/**
 * Device Time Synchronization Utility
 *
 * Ensures all timestamps (both date and time) across the store, admin portal,
 * staff bucket, and customer issues sync cleanly with the staff/admin's local device clock.
 */

import { useState, useEffect } from 'react';

/**
 * Returns the device's IANA timezone (e.g. 'Asia/Kolkata', 'America/New_York')
 */
export function getDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';
  } catch {
    return 'Local';
  }
}

/**
 * Returns current ISO timestamp generated on the device
 */
export function getDeviceNowIso(): string {
  return new Date().toISOString();
}

/**
 * Formats a date/timestamp to the device's local date and time string:
 * e.g. "14 Oct 2026, 05:31 PM"
 */
export function formatDeviceDateTime(
  dateOrIso?: string | number | Date | null,
  options?: { includeSeconds?: boolean; shortDate?: boolean }
): string {
  if (!dateOrIso) return '—';
  try {
    const d = new Date(dateOrIso);
    if (isNaN(d.getTime())) return String(dateOrIso);

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: options?.shortDate ? 'short' : 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: options?.includeSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(d);
  } catch {
    return String(dateOrIso);
  }
}

/**
 * Formats to only device date string: e.g. "14 Oct 2026"
 */
export function formatDeviceDate(dateOrIso?: string | number | Date | null): string {
  if (!dateOrIso) return '—';
  try {
    const d = new Date(dateOrIso);
    if (isNaN(d.getTime())) return String(dateOrIso);

    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return String(dateOrIso);
  }
}

/**
 * Formats to only device time string: e.g. "05:31 PM"
 */
export function formatDeviceTime(
  dateOrIso?: string | number | Date | null,
  includeSeconds = false
): string {
  if (!dateOrIso) return '—';
  try {
    const d = new Date(dateOrIso);
    if (isNaN(d.getTime())) return String(dateOrIso);

    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    }).format(d);
  } catch {
    return String(dateOrIso);
  }
}

/**
 * Formats relative duration or device timestamp
 */
export function formatDeviceRelative(dateOrIso?: string | number | Date | null): string {
  if (!dateOrIso) return '—';
  try {
    const d = new Date(dateOrIso);
    if (isNaN(d.getTime())) return String(dateOrIso);

    const now = Date.now();
    const diffMs = now - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (3600 * 1000));
    const diffDays = Math.floor(diffMs / (86400 * 1000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago (${formatDeviceTime(d)})`;
    if (diffDays === 1) return `Yesterday at ${formatDeviceTime(d)}`;
    return `${diffDays}d ago (${formatDeviceDate(d)})`;
  } catch {
    return String(dateOrIso);
  }
}

/**
 * React hook to keep a live device clock synchronized every second
 */
export function useDeviceClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    now,
    dateString: formatDeviceDate(now),
    timeString: formatDeviceTime(now, true),
    timezone: getDeviceTimezone(),
    formattedFull: formatDeviceDateTime(now, { includeSeconds: true }),
  };
}
