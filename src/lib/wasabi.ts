import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

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
  folder: 'publico' | 'privado';
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

export async function listWasabiFolder(folder: 'publico' | 'privado'): Promise<WasabiObject[]> {
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
export async function initWasabiFolder(folder: 'publico' | 'privado'): Promise<void> {
  const bucket = import.meta.env.VITE_WASABI_BUCKET_NAME as string;
  const params = {
    Bucket: bucket,
    Key: `${folder}/.keep`,
    Body: new Uint8Array(0),
    ContentType: 'application/octet-stream',
    ContentLength: 0,
  };
  console.log(`Creando carpeta en bucket: ${params.Bucket} con Key: ${params.Key}`);
  await wasabiClient.send(new PutObjectCommand(params));
}
