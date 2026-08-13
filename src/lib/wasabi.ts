// Wasabi S3 access via the wasabi-manage edge function proxy.
// All SDK calls happen server-side; the browser only talks to the edge function.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

function manageUrl(params: Record<string, string>): string {
  const u = new URL(`${supabaseUrl}/functions/v1/wasabi-manage`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${anonKey}`, Apikey: anonKey };
}

// ─── Core types ──────────────────────────────────────────────────────────────

export interface ListResult {
  key: string;
  size: number;
  lastModified: Date;
}

export interface ListResponse {
  objects: ListResult[];
  prefixes: string[];
}

export interface WasabiObject {
  key: string;
  folder: 'publico' | 'privado' | 'prevencion';
  nombre: string;
  size: number;
  lastModified: Date;
}

// ─── Core operations ──────────────────────────────────────────────────────────

export async function listViaEdgeFunction(prefix: string, delimiter?: string): Promise<ListResponse> {
  let url = manageUrl({ action: 'list', prefix });
  if (delimiter) url += `&delimiter=${encodeURIComponent(delimiter)}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`Error al listar (${resp.status})`);
  const data = await resp.json();
  const objects: ListResult[] = (data.objects ?? []).map((o: { key: string; size: number; lastModified: string }) => ({
    key: o.key,
    size: o.size,
    lastModified: new Date(o.lastModified),
  }));
  const prefixes: string[] = data.prefixes ?? [];
  return { objects, prefixes };
}

export async function deleteViaEdgeFunction(key: string): Promise<void> {
  const url = manageUrl({ action: 'delete', key });
  const resp = await fetch(url, { method: 'DELETE', headers: authHeaders() });
  if (!resp.ok) throw new Error(`Error al borrar (${resp.status})`);
}

async function uploadViaEdgeFunction(bytes: Uint8Array, key: string, contentType: string): Promise<string> {
  const url = manageUrl({ action: 'upload', key, contentType });
  const resp = await fetch(url, { method: 'PUT', headers: { ...authHeaders(), 'Content-Type': contentType }, body: bytes });
  if (!resp.ok) throw new Error(`Error al subir (${resp.status})`);
  return key;
}

async function copyViaEdgeFunction(srcKey: string, dstKey: string): Promise<void> {
  const url = manageUrl({ action: 'copy', src: srcKey, dst: dstKey });
  const resp = await fetch(url, { method: 'POST', headers: authHeaders() });
  if (!resp.ok) throw new Error(`Error al copiar (${resp.status})`);
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function uploadToWasabi(file: File, path: string): Promise<string> {
  const buffer = await file.arrayBuffer();
  return uploadViaEdgeFunction(new Uint8Array(buffer), path, file.type || 'application/octet-stream');
}

export async function listWasabiFolder(folder: 'publico' | 'privado' | 'prevencion'): Promise<WasabiObject[]> {
  const { objects } = await listViaEdgeFunction(`${folder}/`);
  return objects
    .filter(obj => obj.key && obj.key !== `${folder}/`)
    .map(obj => ({
      key: obj.key,
      folder,
      nombre: obj.key.replace(`${folder}/`, '').replace(/^\d+-/, ''),
      size: obj.size,
      lastModified: obj.lastModified,
    }));
}

export async function deleteFromWasabi(key: string): Promise<void> {
  await deleteViaEdgeFunction(key);
}

export async function initWasabiFolder(folder: 'publico' | 'privado' | 'prevencion'): Promise<void> {
  await uploadViaEdgeFunction(new Uint8Array(0), `${folder}/.keep`, 'application/octet-stream');
}

export async function uploadToWasabiKey(file: File, key: string): Promise<string> {
  const buffer = await file.arrayBuffer();
  return uploadViaEdgeFunction(new Uint8Array(buffer), key, file.type || 'application/octet-stream');
}

export async function uploadBytesToWasabi(bytes: Uint8Array, key: string, contentType: string): Promise<string> {
  return uploadViaEdgeFunction(bytes, key, contentType);
}

export async function getWasabiBlobUrl(key: string): Promise<string> {
  const url = `${supabaseUrl}/functions/v1/wasabi-download?key=${encodeURIComponent(key)}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`Error al descargar (${resp.status})`);
  const blob = await resp.blob();
  return URL.createObjectURL(blob);
}

// ─── RRHH helpers ─────────────────────────────────────────────────────────────

export interface RrhhFolder {
  key: string;
  name: string;
  type: 'privado' | 'publico';
}

export interface RrhhFile {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
}

export async function listRrhhFolders(type: 'privado' | 'publico'): Promise<RrhhFolder[]> {
  const prefix = `rrhh/${type}/`;
  const { prefixes } = await listViaEdgeFunction(prefix, '/');
  return prefixes
    .filter(p => p && p !== prefix)
    .map(p => ({ key: p, name: p.replace(prefix, '').replace(/\/$/, ''), type }));
}

export async function listRrhhEmployeeFiles(folderKey: string): Promise<RrhhFile[]> {
  const { objects } = await listViaEdgeFunction(folderKey);
  return objects
    .filter(obj => obj.key && obj.key !== folderKey && !obj.key.endsWith('/') && !obj.key.endsWith('.keep'))
    .map(obj => ({ key: obj.key, name: obj.key.replace(folderKey, ''), size: obj.size, lastModified: obj.lastModified }));
}

export async function ensureRrhhFolder(folderKey: string): Promise<void> {
  await uploadViaEdgeFunction(new Uint8Array(0), `${folderKey}.keep`, 'application/octet-stream');
}

export async function createWasabiFolder(folderPrefix: string): Promise<void> {
  await uploadViaEdgeFunction(new Uint8Array(0), `${folderPrefix}.keep`, 'application/octet-stream');
}

export async function listAllKeysUnderPrefix(prefix: string): Promise<string[]> {
  const { objects } = await listViaEdgeFunction(prefix);
  return objects.map(o => o.key);
}

export async function uploadRrhhPrivado(file: File, dni: string, nombre: string): Promise<string> {
  const folderKey = `rrhh/privado/${dni}-${nombre}/`;
  await ensureRrhhFolder(folderKey);
  const key = `${folderKey}${file.name}`;
  return uploadToWasabiKey(file, key);
}

export async function listNominasForDni(dni: string): Promise<RrhhFile[]> {
  const prefix = `rrhh/publico/`;
  const { objects } = await listViaEdgeFunction(prefix);
  return objects
    .filter(obj => {
      if (!obj.key || obj.key.endsWith('/')) return false;
      const filename = obj.key.split('/').pop() ?? '';
      return filename.startsWith(dni);
    })
    .map(obj => ({ key: obj.key, name: obj.key.split('/').pop()!, size: obj.size, lastModified: obj.lastModified }));
}

export async function uploadNomina(file: File, dni: string, anio: string, mes: string): Promise<string> {
  const yearKey = `rrhh/publico/${anio}/`;
  const monthKey = `rrhh/publico/${anio}/${mes}/`;
  for (const fk of [yearKey, monthKey]) {
    await uploadViaEdgeFunction(new Uint8Array(0), `${fk}.keep`, 'application/octet-stream');
  }
  const key = `rrhh/publico/${anio}/${mes}/${dni}.pdf`;
  const buffer = await file.arrayBuffer();
  return uploadViaEdgeFunction(new Uint8Array(buffer), key, 'application/pdf');
}

export async function moveRrhhFolderToBajas(dni: string, nombre: string, sociedadSlug: string): Promise<void> {
  const srcPrefix = `rrhh/privado/${dni}-${nombre}/`;
  const dstPrefix = `rrhh/bajas/${sociedadSlug}/${dni}-${nombre}/`;
  await uploadViaEdgeFunction(new Uint8Array(0), `${dstPrefix}.keep`, 'application/octet-stream');
  const { objects } = await listViaEdgeFunction(srcPrefix);
  for (const obj of objects) {
    const relPath = obj.key.replace(srcPrefix, '');
    await copyViaEdgeFunction(obj.key, `${dstPrefix}${relPath}`);
    await deleteViaEdgeFunction(obj.key);
  }
}

export async function moveRrhhFolderToActivo(dni: string, nombre: string, sociedadSlug: string): Promise<void> {
  const srcPrefix = `rrhh/bajas/${sociedadSlug}/${dni}-${nombre}/`;
  const dstPrefix = `rrhh/privado/${dni}-${nombre}/`;
  await uploadViaEdgeFunction(new Uint8Array(0), `${dstPrefix}.keep`, 'application/octet-stream');
  const { objects } = await listViaEdgeFunction(srcPrefix);
  for (const obj of objects) {
    const relPath = obj.key.replace(srcPrefix, '');
    await copyViaEdgeFunction(obj.key, `${dstPrefix}${relPath}`);
    await deleteViaEdgeFunction(obj.key);
  }
}

export async function listBajasEmployeeFiles(sociedadSlug: string, dni: string, nombre: string): Promise<RrhhFile[]> {
  const folderKey = `rrhh/bajas/${sociedadSlug}/${dni}-${nombre}/`;
  const { objects } = await listViaEdgeFunction(folderKey);
  return objects
    .filter(obj => obj.key && !obj.key.endsWith('/') && !obj.key.endsWith('.keep'))
    .map(obj => ({ key: obj.key, name: obj.key.replace(folderKey, ''), size: obj.size, lastModified: obj.lastModified }));
}

export async function uploadPnrJustificante(file: File, dni: string, nombre: string, anio: string): Promise<string> {
  const employeeFolder = `rrhh/privado/${dni}-${nombre}/`;
  const pnrFolder = `${employeeFolder}PNR/`;
  const yearFolder = `${pnrFolder}${anio}/`;
  for (const fk of [employeeFolder, pnrFolder, yearFolder]) {
    await uploadViaEdgeFunction(new Uint8Array(0), `${fk}.keep`, 'application/octet-stream');
  }
  const ts = Date.now();
  const key = `${yearFolder}${ts}-${file.name}`;
  const buffer = await file.arrayBuffer();
  return uploadViaEdgeFunction(new Uint8Array(buffer), key, file.type || 'application/octet-stream');
}

function sanitizePath(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

export async function uploadVacacionesLetter(
  blob: Blob, dni: string, nombre: string, anio: string, fechaInicio: string
): Promise<string> {
  const safe = sanitizePath(nombre);
  const employeeFolder = `rrhh/privado/${dni}-${safe}/`;
  const vacFolder = `${employeeFolder}Vacaciones/`;
  for (const fk of [employeeFolder, vacFolder]) {
    await uploadViaEdgeFunction(new Uint8Array(0), `${fk}.keep`, 'application/octet-stream');
  }
  const fileName = `${dni}-${safe}-Vacaciones-${anio}-${fechaInicio}.pdf`;
  const key = `${vacFolder}${fileName}`;
  const bytes = await blob.arrayBuffer();
  await uploadViaEdgeFunction(new Uint8Array(bytes), key, 'application/pdf');
  return key;
}

export async function uploadFirmadaLetter(
  blob: Blob, dni: string, nombre: string, anio: string, fechaInicio: string
): Promise<string> {
  const safe = sanitizePath(nombre);
  const firmadaFolder = `rrhh/privado/${dni}-${safe}/Vacaciones/firmadas/`;
  await uploadViaEdgeFunction(new Uint8Array(0), `${firmadaFolder}.keep`, 'application/octet-stream');
  const fileName = `${dni}-${safe}-Vacaciones-${anio}-${fechaInicio}-FIRMADA.pdf`;
  const key = `${firmadaFolder}${fileName}`;
  const bytes = await blob.arrayBuffer();
  await uploadViaEdgeFunction(new Uint8Array(bytes), key, 'application/pdf');
  return key;
}

export async function downloadFromWasabi(key: string, filename: string): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/wasabi-download?key=${encodeURIComponent(key)}`;
  const resp = await fetch(url, { headers: authHeaders() });
  if (!resp.ok) throw new Error(`Error al descargar el archivo (${resp.status})`);
  const blob = await resp.blob();
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeByExt: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
  const finalBlob = new Blob([blob], { type: mimeByExt[ext ?? ''] ?? blob.type ?? 'application/octet-stream' });
  const blobUrl = URL.createObjectURL(finalBlob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

// List one level deep: immediate subfolders and files under a prefix
export async function listPrefixOneLevelDeep(prefix: string): Promise<{ folders: { name: string; prefix: string }[]; files: RrhhFile[] }> {
  const { objects, prefixes } = await listViaEdgeFunction(prefix, '/');
  const folders = prefixes
    .filter(p => p && p !== prefix)
    .map(p => ({ prefix: p, name: p.replace(prefix, '').replace(/\/$/, '') }));
  const files = objects
    .filter(o => o.key && o.key !== prefix && !o.key.endsWith('.keep'))
    .map(o => ({ key: o.key, name: o.key.replace(prefix, ''), size: o.size, lastModified: o.lastModified }));
  return { folders, files };
}
