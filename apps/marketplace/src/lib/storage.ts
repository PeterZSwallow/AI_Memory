import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // also the Claude API per-image limit

const bucket = process.env.S3_BUCKET;
const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

const s3 = bucket
  ? new S3Client({
      region: process.env.S3_REGION ?? "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
      credentials:
        process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
          : undefined,
    })
  : null;

/** Stores an image and returns its storage key and the public URL to reference it by. */
export async function saveImage(data: Buffer, contentType: string): Promise<{ key: string; url: string }> {
  const ext = ALLOWED_IMAGE_TYPES[contentType];
  if (!ext) throw new Error("Unsupported image type");
  const key = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  if (s3 && bucket) {
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
    const publicBase = process.env.S3_PUBLIC_URL;
    return { key, url: publicBase ? `${publicBase.replace(/\/$/, "")}/${key}` : `/api/uploads/${key}` };
  }
  const file = path.join(uploadDir, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, data);
  return { key, url: `/api/uploads/${key}` };
}

/** Reads an uploaded image by key (used by the /api/uploads route and the AI pipeline). */
export async function readImage(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (key.includes("..")) return null;
  const ext = key.split(".").pop() ?? "";
  const contentType = Object.entries(ALLOWED_IMAGE_TYPES).find(([, e]) => e === ext)?.[0];
  if (!contentType) return null;
  try {
    if (s3 && bucket) {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await res.Body?.transformToByteArray();
      return bytes ? { data: Buffer.from(bytes), contentType } : null;
    }
    const file = path.join(uploadDir, key);
    if (!file.startsWith(uploadDir + path.sep)) return null;
    return { data: await readFile(file), contentType };
  } catch {
    return null;
  }
}
