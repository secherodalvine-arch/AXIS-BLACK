/**
 * traffic.ts
 * Captures user end traffic, page navigation, device telemetry, local timestamp,
 * and user interactions, sending them to the Admin Platform capture endpoint using native fetch.
 * NOTE: Admin platform traffic and administrator accounts are strictly excluded.
 */

import { getDeviceDetails, resolveClientGeoAsync, DeviceDetails } from './captureInfo';
import { getStoredUser } from './api';

export function getApiBaseUrl(): string {
  const metaEnv = (import.meta as any).env || {};
  let base: string = metaEnv.VITE_API_BASE_URL || metaEnv.VITE_API_URL || '';
  if (!base) {
    if (typeof window !== 'undefined' && window.location.origin) {
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocalhost && window.location.port !== '8000') {
        return 'http://localhost:8000/api';
      }
      return `${window.location.origin}/api`;
    }
    return 'http://localhost:8000/api';
  }
  base = base.trim().replace(/\/+$/, '');
  if (!base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

export interface CapturePayload {
  user_id?: string;
  visitor_id?: string;
  user_email?: string;
  user_name?: string;
  event: string;
  page: string;
  data?: any;
  device?: string;
  device_type?: 'Desktop' | 'Mobile' | 'Tablet';
  browser?: string;
  os?: string;
  ua?: string;
  screen_resolution?: string;
  timezone?: string;
  local_time?: string;
  local_date?: string;
  local_datetime_iso?: string;
  ip?: string;
  city?: string;
  country?: string;
  location?: string;
  referrer?: string;
}

let memoryVisitorId = '';

/**
 * Returns or generates a persistent visitor ID for anonymous traffic recording.
 * Preserves the exact same visitor token across navigations, auth pages, and tab switches.
 */
export function getOrCreateVisitorId(): string {
  try {
    let vid = localStorage.getItem('axis_visitor_id');
    if (!vid) {
      vid = memoryVisitorId || ('v_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36));
      try {
        localStorage.setItem('axis_visitor_id', vid);
      } catch {}
    }
    memoryVisitorId = vid;
    return vid;
  } catch {
    if (!memoryVisitorId) {
      memoryVisitorId = 'v_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    }
    return memoryVisitorId;
  }
}

let lastCapturedKey = '';
let lastCapturedTimestamp = 0;

/**
 * Sends a telemetry / traffic capture event to the backend Admin API.
 * Excludes administrator sessions and admin platform views.
 */
export const captureEvent = async (payload: Partial<CapturePayload>) => {
  try {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    if (currentPath.startsWith('/admin')) {
      return;
    }

    const user = getStoredUser();
    const visitorId = getOrCreateVisitorId();
    const now = Date.now();
    const currentPage = payload.page || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
    const currentEvent = payload.event || 'page_view';
    const dedupKey = `${currentEvent}:${currentPage}:${user?.user_id || user?.id || visitorId}`;

    // Suppress identical rapid duplicate navigation bursts within 600ms
    if (dedupKey === lastCapturedKey && now - lastCapturedTimestamp < 600) {
      return;
    }
    lastCapturedKey = dedupKey;
    lastCapturedTimestamp = now;

    // Fast-resolve client geo with 300ms race for rich first-touch telemetry
    try {
      const geoWait = resolveClientGeoAsync();
      await Promise.race([geoWait, new Promise((r) => setTimeout(r, 250))]);
    } catch {}

    const deviceDetails: DeviceDetails = getDeviceDetails();

    const fullPayload: CapturePayload = {
      user_id: user?.user_id || user?.id,
      visitor_id: visitorId,
      user_email: user?.email,
      user_name: user?.full_name || user?.name,
      event: currentEvent,
      page: currentPage,
      data: payload.data || {},
      device: deviceDetails.device,
      device_type: deviceDetails.device_type,
      browser: deviceDetails.browser,
      os: deviceDetails.os,
      ua: deviceDetails.user_agent,
      screen_resolution: deviceDetails.screen_resolution,
      timezone: deviceDetails.timezone,
      local_time: deviceDetails.local_time,
      local_date: deviceDetails.local_date,
      local_datetime_iso: deviceDetails.local_datetime_iso,
      ip: deviceDetails.ip,
      city: deviceDetails.city,
      country: deviceDetails.country,
      location: deviceDetails.location,
      referrer: typeof document !== 'undefined' ? (document.referrer || 'Direct') : 'Direct',
      ...payload
    };

    const apiBase = getApiBaseUrl();
    const targetUrl = `${apiBase}/admin/capture`;
    const payloadStr = JSON.stringify(fullPayload);

    if (typeof navigator !== 'undefined' && navigator.sendBeacon && payload.event === 'unload') {
      try {
        const blob = new Blob([payloadStr], { type: 'application/json' });
        navigator.sendBeacon(targetUrl, blob);
        return;
      } catch {}
    }

    fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
      keepalive: true,
    }).catch(() => {
      // Fallback compat endpoint
      fetch(`${apiBase}/admin/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payloadStr,
      }).catch(() => {});
    });
  } catch (e) {
    // Silently suppress errors to protect UX
  }
};

export const recordTraffic = captureEvent;
