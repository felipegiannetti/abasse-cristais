import { fmt } from '@/i18n/config';
import type { Messages } from '@/i18n';

const MAX_SIDE = 1800;
// Vercel limits each request body to ~4.5 MB.
const MAX_BYTES = 3.8 * 1024 * 1024;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * Resizes and compresses the photo in the browser before upload:
 * phone photos (8–15 MB) become ~300 KB–1 MB, so uploads are fast and the site stays light.
 */
export async function prepareImage(file: File, msgs: Messages['admin']['images']): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error(fmt(msgs.notImage, { name: file.name }));
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error(fmt(msgs.unreadable, { name: file.name }));
  });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error(msgs.noCanvas);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let blob: Blob | null = null;
  for (const quality of [0.86, 0.76, 0.64, 0.5]) {
    blob = await toBlob(canvas, 'image/webp', quality);
    // browsers without WebP support return PNG: fall back to JPEG
    if (blob && blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (blob && blob.size <= MAX_BYTES) break;
  }
  if (!blob || blob.size > MAX_BYTES) throw new Error(fmt(msgs.tooBig, { name: file.name }));

  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'photo';
  return new File([blob], `${base}.${ext}`, { type: blob.type });
}
