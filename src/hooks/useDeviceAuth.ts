import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'kiosk_device_key';

export type DeviceStatus = 'checking' | 'authorized' | 'unauthorized' | 'disabled';

export interface DeviceInfo {
  device_key: string;
  site_name: string;
}

export function useDeviceAuth() {
  const [status, setStatus] = useState<DeviceStatus>('checking');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  const validate = useCallback(async () => {
    const key = localStorage.getItem(STORAGE_KEY);
    if (!key) {
      setStatus('unauthorized');
      setDeviceInfo(null);
      return;
    }
    const { data, error } = await supabase
      .from('kiosk_devices')
      .select('device_key, site_name, is_active')
      .eq('device_key', key)
      .maybeSingle();

    if (error || !data) {
      setStatus('unauthorized');
      setDeviceInfo(null);
      return;
    }
    if (!data.is_active) {
      setStatus('disabled');
      setDeviceInfo({ device_key: data.device_key, site_name: data.site_name });
      return;
    }
    setStatus('authorized');
    setDeviceInfo({ device_key: data.device_key, site_name: data.site_name });
  }, []);

  useEffect(() => {
    validate();
  }, [validate]);

  const registerDevice = useCallback(async (deviceKey: string, siteName: string): Promise<{ ok: boolean; error?: string }> => {
    // Check if this key already exists
    const { data: existing } = await supabase
      .from('kiosk_devices')
      .select('id, is_active')
      .eq('device_key', deviceKey)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        return { ok: false, error: 'Este código de dispositivo ya existe pero está desactivado.' };
      }
      // Already registered and active — just save locally
      localStorage.setItem(STORAGE_KEY, deviceKey);
      await validate();
      return { ok: true };
    }

    const { error } = await supabase.from('kiosk_devices').insert({ device_key: deviceKey, site_name: siteName });
    if (error) return { ok: false, error: error.message };

    localStorage.setItem(STORAGE_KEY, deviceKey);
    await validate();
    return { ok: true };
  }, [validate]);

  const clearDevice = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStatus('unauthorized');
    setDeviceInfo(null);
  }, []);

  const getStoredKey = () => localStorage.getItem(STORAGE_KEY);

  return { status, deviceInfo, validate, registerDevice, clearDevice, getStoredKey };
}
