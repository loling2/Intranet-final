const STORAGE_KEY = 'app_device_key';
const COOKIE_KEY = 'app_device_key';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number): void {
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/${secure}; SameSite=Lax`;
}

export function getOrCreateDeviceKey(): string {
  // 1. Check localStorage (fast cache)
  let key = localStorage.getItem(STORAGE_KEY);
  if (key) {
    // Ensure cookie is also set for long-term persistence
    if (!readCookie(COOKIE_KEY)) writeCookie(COOKIE_KEY, key, COOKIE_MAX_AGE);
    return key;
  }

  // 2. Check cookie (survives iOS Safari localStorage eviction)
  key = readCookie(COOKIE_KEY);
  if (key) {
    localStorage.setItem(STORAGE_KEY, key);
    return key;
  }

  // 3. Generate new key and store in both places
  key = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  localStorage.setItem(STORAGE_KEY, key);
  writeCookie(COOKIE_KEY, key, COOKIE_MAX_AGE);
  return key;
}

export function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const tablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const type = tablet ? 'Tablet' : mobile ? 'Móvil' : 'Escritorio';
  const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : /Edge/i.test(ua) ? 'Edge' : 'Navegador';
  const os = /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Android/i.test(ua) ? 'Android' : /iOS|iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Sistema';
  return `${type} · ${browser} · ${os}`;
}
