import { supabase } from '../supabaseClient';

let cache: Record<string, string> = {};
let loaded = false;

export async function loadSocietyLogos(): Promise<Record<string, string>> {
  if (loaded) return cache;
  const { data } = await supabase.from('ui_settings').select('key, value');
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    const m = row.key.match(/^society_logo_(.+)$/);
    if (m && row.value) map[m[1]] = row.value;
  }
  cache = map;
  loaded = true;
  return cache;
}

export async function getSocietyLogo(societyId: string): Promise<string | null> {
  const logos = await loadSocietyLogos();
  return logos[societyId] ?? null;
}

export function clearSocietyLogosCache() {
  cache = {};
  loaded = false;
}
