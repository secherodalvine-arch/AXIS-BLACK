/**
 * traffic.ts
 * Captures user end traffic, page navigation, device telemetry, local timestamp,
 * and user interactions, sending them to the Admin Platform capture endpoint using native fetch.
 */

import { getDeviceDetails, resolveClientGeoAsync, DeviceDetails } from './captureInfo';
import { getStoredUser } from './api';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/api';

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
 */
export const captureEvent = async (payload: Partial<CapturePayload>) => {
  try {
    const user = getStoredUser();
    const visitorId = getOrCreateVisitorId();
    const now = Date.now();
    const currentPage = payload.page || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
    const currentEvent = payload.event || 'page_view';
    const dedupKey = `${currentEvent}:${currentPage}:${user?.user_id || user?.id || visitorId}`;

    // Suppress identical rapid duplicate navigation bursts within 800ms
    if (dedupKey === lastCapturedKey && now - lastCapturedTimestamp < 800) {
      return;
    }
    lastCapturedKey = dedupKey;
    lastCapturedTimestamp = now;

    const deviceDetails: DeviceDetails = getDeviceDetails();

    const fullPayload: CapturePayload = {
      user_id: user?.user_id || user?.id,
      visitor_id: visitorId,
      user_email: user?.email,
      user_name: user?.full_name || user?.name,
      event: payload.event || 'page_view',
      page: payload.page || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/'),
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
      referrer: typeof document !== 'undefined' ? document.referrer || 'Direct' : 'Direct',
      ...payload
    };

    // Enrich with geo asynchronously if available
    resolveClientGeoAsync().then(geo => {
      if (geo.city && !fullPayload.city) {
        fullPayload.city = geo.city;
        fullPayload.country = geo.country;
        fullPayload.location = geo.location;
        fullPayload.ip = geo.ip;
      }
    }).catch(() => {});

    const targetUrl = `${API_BASE_URL.replace(/\/+$/, '')}/admin/capture`;
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
      // Fallback
      fetch(`${API_BASE_URL.replace(/\/+$/, '')}/admin/track`, {
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
