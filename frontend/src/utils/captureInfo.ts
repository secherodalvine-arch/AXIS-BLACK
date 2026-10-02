/**
 * captureInfo.ts
 * Captures comprehensive client device, browser, OS, local date/time,
 * timezone, and geolocation details for platform synchronization.
 */

export interface DeviceDetails {
  device: string; // e.g. "Desktop • Chrome • Windows"
  device_type: 'Desktop' | 'Mobile' | 'Tablet';
  browser: string;
  os: string;
  user_agent: string;
  screen_resolution: string;
  language: string;
  platform: string;
  timezone: string; // e.g. "Africa/Nairobi"
  timezone_offset: number; // in minutes, e.g. -180
  local_date: string; // YYYY-MM-DD in user's local timezone
  local_time: string; // HH:mm:ss in user's local timezone
  local_datetime_iso: string; // Local ISO string with timezone offset
  ip?: string;
  city?: string;
  country?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

let cachedIpGeo: { ip?: string; city?: string; country?: string; location?: string; lat?: number; lon?: number } | null = null;
if (typeof window !== 'undefined') {
  try {
    const raw = sessionStorage.getItem('axis_geo_cache') || localStorage.getItem('axis_geo_cache');
    if (raw) {
      cachedIpGeo = JSON.parse(raw);
    }
  } catch {}
}
let isResolvingGeo = false;

/**
 * Returns the device type based on user agent and screen traits.
 */
export function getDeviceType(): 'Desktop' | 'Mobile' | 'Tablet' {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) return 'Mobile';
  if (typeof window !== 'undefined' && window.innerWidth <= 768) return 'Mobile';
  return 'Desktop';
}

/**
 * Detects the user's browser name and version.
 */
export function getBrowserName(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Browser';
}

/**
 * Detects the user's Operating System.
 */
export function getOSName(): string {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent;
  if (ua.includes('Windows NT 10.0')) return 'Windows 10/11';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'OS';
}

/**
 * Returns the current date in YYYY-MM-DD format according to the user's local clock.
 * Crucial fix: never uses UTC slice `new Date().toISOString().split('T')[0]` which shifts days.
 */
export function getDeviceLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the current time in HH:mm:ss format in user's local device time.
 */
export function getDeviceLocalTimeString(date: Date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Returns ISO-like string with local timezone offset (e.g. 2026-10-01T22:40:11+03:00).
 */
export function getDeviceLocalIsoString(date: Date = new Date()): string {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num: number) => String(Math.floor(Math.abs(num))).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    dif + pad(tzo / 60) +
    ':' + pad(tzo % 60)
  );
}

/**
 * Synchronously grabs all available device and time details.
 */
export function getDeviceDetails(): DeviceDetails {
  const now = new Date();
  const browser = getBrowserName();
  const os = getOSName();
  const deviceType = getDeviceType();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const timezone_offset = now.getTimezoneOffset();
  const screen = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}` : '1920x1080';
  const language = typeof navigator !== 'undefined' ? navigator.language || 'en' : 'en';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';
  const user_agent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

  const details: DeviceDetails = {
    device: `${deviceType} • ${browser} • ${os}`,
    device_type: deviceType,
    browser,
    os,
    user_agent,
    screen_resolution: screen,
    language,
    platform,
    timezone,
    timezone_offset,
    local_date: getDeviceLocalDateString(now),
    local_time: getDeviceLocalTimeString(now),
    local_datetime_iso: getDeviceLocalIsoString(now),
    city: cachedIpGeo?.city,
    country: cachedIpGeo?.country,
    location: cachedIpGeo?.location,
    ip: cachedIpGeo?.ip,
    latitude: cachedIpGeo?.lat,
    longitude: cachedIpGeo?.lon,
  };

  return details;
}

/**
 * Asynchronously enriches device details with public IP & Geolocation (cached in memory).
 */
export async function resolveClientGeoAsync(): Promise<DeviceDetails> {
  const details = getDeviceDetails();

  if (cachedIpGeo) {
    return { ...details, ...cachedIpGeo };
  }

  if (isResolvingGeo) {
    return details;
  }

  isResolvingGeo = true;
  try {
    const resp = await fetch('https://ipapi.co/json/', { cache: 'force-cache' });
    if (resp.ok) {
      const data = await resp.json();
      if (data && data.ip) {
        cachedIpGeo = {
          ip: data.ip,
          city: data.city,
          country: data.country_name || data.country,
          location: `${data.city ? data.city + ', ' : ''}${data.country_name || data.country || ''}`,
          lat: data.latitude,
          lon: data.longitude,
        };
        try {
          sessionStorage.setItem('axis_geo_cache', JSON.stringify(cachedIpGeo));
          localStorage.setItem('axis_geo_cache', JSON.stringify(cachedIpGeo));
        } catch {}
        return { ...details, ...cachedIpGeo };
      }
    }
  } catch {
    // Secondary fallback for public IP
    try {
      const ipResp = await fetch('https://api.ipify.org?format=json');
      if (ipResp.ok) {
        const ipData = await ipResp.json();
        if (ipData && ipData.ip) {
          cachedIpGeo = {
            ip: ipData.ip,
            city: '',
            country: '',
            location: '',
          };
          try {
            sessionStorage.setItem('axis_geo_cache', JSON.stringify(cachedIpGeo));
          } catch {}
          return { ...details, ...cachedIpGeo };
        }
      }
    } catch {}
  } finally {
    isResolvingGeo = false;
  }

  return details;
}
