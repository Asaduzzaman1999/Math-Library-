import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

export type BucketCategory =
  | 'LessonVideos'
  | 'VideoThumbnails'
  | 'StudentAnswerScripts'
  | 'EvaluatedAnswerScripts'
  | 'PdfResources'
  | 'Images'
  | 'GeneratedReports';

export type CompressionProfile = 'HighQuality' | 'Balanced' | 'SmallSize' | 'None';

const STORAGE_ROOT = path.resolve(process.cwd(), 'private_storage');
const FALLBACK_SIGNING_KEY = crypto.randomBytes(32);

function getSigningKey(): Buffer | string {
  return process.env.FILE_SIGNING_SECRET || FALLBACK_SIGNING_KEY;
}

export function resolveConfinedPath(objectKey: string): string {
  const sanitized = objectKey.replace(/^\/+/, '');
  const resolved = path.resolve(STORAGE_ROOT, sanitized);
  if (!resolved.startsWith(STORAGE_ROOT + path.sep)) {
    throw new Error('Invalid storage path traversal attempt');
  }
  return resolved;
}

export function validateMagicBytes(buffer: Buffer, expectedType: 'pdf' | 'image' | 'video'): boolean {
  if (buffer.length < 4) return false;
  if (expectedType === 'pdf') {
    return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (expectedType === 'image') {
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    return isJpeg || isPng;
  }
  if (expectedType === 'video') {
    // Allow MP4 (ftyp at offset 4) or WebM (1A 45 DF A3)
    const isMp4 = buffer.length >= 8 && buffer.subarray(4, 8).toString('ascii') === 'ftyp';
    const isWebm =
      buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    return isMp4 || isWebm;
  }
  return false;
}

export async function optimizePdfBuffer(
  rawPdf: Buffer,
  profile: CompressionProfile
): Promise<{ buffer: Buffer; pageCount: number; originalSize: number; optimizedSize: number }> {
  const originalSize = rawPdf.length;
  const pdfDoc = await PDFDocument.load(rawPdf, { ignoreEncryption: true });
  const pageCount = pdfDoc.getPageCount();

  // Strip unnecessary metadata to reduce bloat and protect student PII
  pdfDoc.setTitle('');
  pdfDoc.setAuthor('');
  pdfDoc.setSubject('');
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer('Math Library Optimizer');
  pdfDoc.setCreator('Math Library');

  const useObjectStreams = profile !== 'None';
  const savedBytes = await pdfDoc.save({
    useObjectStreams,
    addDefaultPage: false,
    objectsPerTick: profile === 'SmallSize' ? 100 : 50,
  });

  const outBuf = Buffer.from(savedBytes);
  return {
    buffer: outBuf,
    pageCount,
    originalSize,
    optimizedSize: outBuf.length,
  };
}

export async function savePrivateObject(
  category: BucketCategory,
  extension: string,
  data: Buffer
): Promise<{ objectKey: string; sha256: string; sizeBytes: number }> {
  const uniqueId = crypto.randomUUID();
  const safeExt = extension.replace(/[^a-zA-Z0-9.]/g, '').toLowerCase() || '.bin';
  const objectKey = `${category}/${uniqueId}${safeExt.startsWith('.') ? safeExt : '.' + safeExt}`;
  const fullPath = resolveConfinedPath(objectKey);

  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, data);

  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  return {
    objectKey,
    sha256,
    sizeBytes: data.length,
  };
}

export async function readPrivateObject(objectKey: string): Promise<Buffer> {
  const fullPath = resolveConfinedPath(objectKey);
  return fs.readFile(fullPath);
}

export function createSignedFileUrl(fileId: number, viewerUserId: number, ttlSeconds = 300): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${fileId}:${viewerUserId}:${expiresAt}`;
  const sig = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex');
  return `/api/files/signed?fileId=${fileId}&uid=${viewerUserId}&expires=${expiresAt}&sig=${sig}`;
}

export function verifySignedFileParams(
  fileId: number,
  viewerUserId: number,
  expires: number,
  sig: string
): boolean {
  if (!Number.isFinite(fileId) || !Number.isFinite(viewerUserId) || !Number.isFinite(expires)) {
    return false;
  }
  if (Math.floor(Date.now() / 1000) > expires) {
    return false;
  }
  const payload = `${fileId}:${viewerUserId}:${expires}`;
  const expected = crypto.createHmac('sha256', getSigningKey()).update(payload).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(sig || '', 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
