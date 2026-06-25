import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';

const wasabiClient = new S3Client({
  endpoint: import.meta.env.VITE_WASABI_ENDPOINT as string,
  region: 'eu-central-2',
  credentials: {
    accessKeyId: import.meta.env.VITE_WASABI_ACCESS_KEY as string,
    secretAccessKey: import.meta.env.VITE_WASABI_SECRET_KEY as string,
  },
  forcePathStyle: true,
});

export interface WasabiObject {
  key: string;          // e.g. "publico/1234-file.pdf"
  folder: 'publico' | 'privado' | 'prevencion';
  nombre: string;       // original filename portion
  size: number;
  lastModified: Date;
}

export async function uploadToWasabi(file: File, path: string): Promise<string> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const buffer = await file.arrayBuffer();

  const params = {
    Bucket: bucket,
    Key: path,
    Body: new Uint8Array(buffer),
    ContentType: file.type || 'application/octet-stream',
    ContentLength: file.size,
  };

  console.log(`Subiendo a bucket: ${params.Bucket} con Key: ${params.Key}`);

  await wasabiClient.send(new PutObjectCommand(params));

  return `${import.meta.env.VITE_WASABI_ENDPOINT as string}/${bucket}/${path}`;
}

export async function listWasabiFolder(folder: 'publico' | 'privado' | 'prevencion'): Promise<WasabiObject[]> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;

  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `${folder}/`,
  });

  const response = await wasabiClient.send(command);
  const contents = response.Contents ?? [];

  return contents
    .filter((obj) => obj.Key && obj.Key !== `${folder}/`) // skip the folder placeholder itself
    .map((obj) => ({
      key: obj.Key!,
      folder,
      nombre: obj.Key!.replace(`${folder}/`, '').replace(/^\d+-/, ''), // strip timestamp prefix
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
    }));
}

export async function deleteFromWasabi(key: string): Promise<void> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  await wasabiClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Creates the folder prefix in Wasabi by uploading a zero-byte placeholder
export async function initWasabiFolder(folder: 'publico' | 'privado' | 'prevencion'): Promise<void> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const params = {
    Bucket: bucket,
    Key: `${folder}/.keep`,
    Body: new Uint8Array(0),
    ContentType: 'application/octet-stream',
    ContentLength: 0,
  };
  await wasabiClient.send(new PutObjectCommand(params));
}

// Upload a file to any arbitrary key path (used by PRL module for dynamic folder paths)
export async function uploadToWasabiKey(file: File, key: string): Promise<string> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const buffer = await file.arrayBuffer();
  await wasabiClient.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: new Uint8Array(buffer),
    ContentType: file.type || 'application/octet-stream',
    ContentLength: file.size,
  }));
  return key;
}

// Upload raw bytes to an arbitrary key (used by nominas module for in-memory PDFs)
export async function uploadBytesToWasabi(bytes: Uint8Array, key: string, contentType: string): Promise<string> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  await wasabiClient.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: bytes,
    ContentType: contentType,
    ContentLength: bytes.byteLength,
  }));
  return key;
}

// Fetch a file from Wasabi and return an object URL for in-browser preview
export async function getWasabiBlobUrl(key: string): Promise<string> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const resp = await wasabiClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = resp.Body as ReadableStream;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: d } = await reader.read();
    if (value) chunks.push(value);
    done = d;
  }
  const blob = new Blob(chunks, { type: resp.ContentType ?? 'application/octet-stream' });
  return URL.createObjectURL(blob);
}

// ─── RRHH helpers ────────────────────────────────────────────────────────────

export interface RrhhFolder {
  key: string;        // full S3 key of the folder prefix, e.g. "rrhh/privado/12345678A-Juan Perez/"
  name: string;       // display name, e.g. "12345678A-Juan Perez"
  type: 'privado' | 'publico';
}

export interface RrhhFile {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
}

// List all employee folders under rrhh/privado/ or rrhh/publico/
export async function listRrhhFolders(type: 'privado' | 'publico'): Promise<RrhhFolder[]> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const prefix = `rrhh/${type}/`;
  const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: '/' });
  const resp = await wasabiClient.send(command);
  const prefixes = resp.CommonPrefixes ?? [];
  return prefixes
    .filter(p => p.Prefix && p.Prefix !== prefix)
    .map(p => ({
      key: p.Prefix!,
      name: p.Prefix!.replace(prefix, '').replace(/\/$/, ''),
      type,
    }));
}

// List files inside an employee folder (non-recursive)
export async function listRrhhEmployeeFiles(folderKey: string): Promise<RrhhFile[]> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: folderKey });
  const resp = await wasabiClient.send(command);
  return (resp.Contents ?? [])
    .filter(obj => obj.Key && obj.Key !== folderKey && !obj.Key!.endsWith('/') && !obj.Key!.endsWith('.keep'))
    .map(obj => ({
      key: obj.Key!,
      name: obj.Key!.replace(folderKey, ''),
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
    }));
}

// Ensure a folder prefix exists by uploading a zero-byte placeholder if not present
export async function ensureRrhhFolder(folderKey: string): Promise<void> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const keepKey = `${folderKey}.keep`;
  // Try listing — if at least one object exists under this prefix, folder exists
  const resp = await wasabiClient.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: folderKey, MaxKeys: 1 }));
  if (!resp.Contents?.length) {
    await wasabiClient.send(new PutObjectCommand({
      Bucket: bucket,
      Key: keepKey,
      Body: new Uint8Array(0),
      ContentType: 'application/octet-stream',
      ContentLength: 0,
    }));
  }
}

// Upload a document to rrhh/privado/<dni>-<nombre>/filename
export async function uploadRrhhPrivado(file: File, dni: string, nombre: string): Promise<string> {
  const folderKey = `rrhh/privado/${dni}-${nombre}/`;
  await ensureRrhhFolder(folderKey);
  const key = `${folderKey}${file.name}`;
  await uploadToWasabiKey(file, key);
  return key;
}

// List nomina files under rrhh/publico/<año>/<mes>/ that start with <dni>
export async function listNominasForDni(dni: string): Promise<RrhhFile[]> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const prefix = `rrhh/publico/`;
  const command = new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix });
  const resp = await wasabiClient.send(command);
  return (resp.Contents ?? [])
    .filter(obj => {
      if (!obj.Key || obj.Key.endsWith('/')) return false;
      const filename = obj.Key.split('/').pop() ?? '';
      return filename.startsWith(dni);
    })
    .map(obj => ({
      key: obj.Key!,
      name: obj.Key!.split('/').pop()!,
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
    }));
}

// Upload a nomina PDF: rrhh/publico/<año>/<mes>/<dni>.pdf
export async function uploadNomina(file: File, dni: string, anio: string, mes: string): Promise<string> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  // Ensure year folder
  const yearKey = `rrhh/publico/${anio}/`;
  const monthKey = `rrhh/publico/${anio}/${mes}/`;
  for (const fk of [yearKey, monthKey]) {
    const resp = await wasabiClient.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: fk, MaxKeys: 1 }));
    if (!resp.Contents?.length) {
      await wasabiClient.send(new PutObjectCommand({
        Bucket: bucket, Key: `${fk}.keep`,
        Body: new Uint8Array(0), ContentType: 'application/octet-stream', ContentLength: 0,
      }));
    }
  }
  const key = `rrhh/publico/${anio}/${mes}/${dni}.pdf`;
  const buffer = await file.arrayBuffer();
  await wasabiClient.send(new PutObjectCommand({
    Bucket: bucket, Key: key,
    Body: new Uint8Array(buffer), ContentType: 'application/pdf', ContentLength: file.size,
  }));
  return key;
}

// Move all files under rrhh/privado/<dni>-<nombre>/ to rrhh/bajas/<sociedadSlug>/<dni>-<nombre>/
export async function moveRrhhFolderToBajas(dni: string, nombre: string, sociedadSlug: string): Promise<void> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const srcPrefix = `rrhh/privado/${dni}-${nombre}/`;
  const dstPrefix = `rrhh/bajas/${sociedadSlug}/${dni}-${nombre}/`;

  // Ensure destination folder exists
  await wasabiClient.send(new PutObjectCommand({
    Bucket: bucket, Key: `${dstPrefix}.keep`,
    Body: new Uint8Array(0), ContentType: 'application/octet-stream', ContentLength: 0,
  }));

  // List all objects under source prefix
  const resp = await wasabiClient.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: srcPrefix }));
  const objects = resp.Contents ?? [];

  for (const obj of objects) {
    if (!obj.Key) continue;
    const relPath = obj.Key.replace(srcPrefix, '');
    const dstKey = `${dstPrefix}${relPath}`;
    // Copy to destination
    await wasabiClient.send(new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `${bucket}/${obj.Key}`,
      Key: dstKey,
    }));
    // Delete original
    await wasabiClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
  }
}

// List files for a baja employee under rrhh/bajas/<sociedadSlug>/<dni>-<nombre>/
export async function listBajasEmployeeFiles(sociedadSlug: string, dni: string, nombre: string): Promise<RrhhFile[]> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const folderKey = `rrhh/bajas/${sociedadSlug}/${dni}-${nombre}/`;
  const resp = await wasabiClient.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: folderKey }));
  return (resp.Contents ?? [])
    .filter(obj => obj.Key && !obj.Key.endsWith('/') && !obj.Key.endsWith('.keep'))
    .map(obj => ({
      key: obj.Key!,
      name: obj.Key!.replace(folderKey, ''),
      size: obj.Size ?? 0,
      lastModified: obj.LastModified ?? new Date(),
    }));
}

// Download a file by key and trigger browser download
export async function downloadFromWasabi(key: string, filename: string): Promise<void> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const resp = await wasabiClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const stream = resp.Body as ReadableStream;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;
  while (!done) {
    const { value, done: d } = await reader.read();
    if (value) chunks.push(value);
    done = d;
  }
  const blob = new Blob(chunks, { type: resp.ContentType ?? 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
