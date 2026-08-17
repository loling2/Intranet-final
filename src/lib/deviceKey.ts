const STORAGE_KEY = 'app_device_key';

export function getOrCreateDeviceKey(): string {
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(STORAGE_KEY, key);
  }
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
