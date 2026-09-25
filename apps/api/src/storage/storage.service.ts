import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { del, put } from '@vercel/blob';
import { config } from '../config';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');

export type ImageKind = { mime: string; ext: string };

/** Identifica o formato pelos bytes reais do arquivo — nunca confia no nome/Content-Type enviados. */
export function detectImage(buf: Buffer): ImageKind | null {
  if (buf.length > 12) {
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { mime: 'image/png', ext: 'png' };
    }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      return { mime: 'image/webp', ext: 'webp' };
    }
  }
  return null;
}

/**
 * Produção: Vercel Blob (URL pública, CDN).
 * Desenvolvimento sem token: grava em ./uploads (a Vercel tem disco somente leitura).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  async save(buf: Buffer, kind: ImageKind): Promise<string> {
    const name = `${randomUUID()}.${kind.ext}`;

    if (config.blobToken) {
      const blob = await put(`products/${name}`, buf, {
        access: 'public',
        contentType: kind.mime,
        token: config.blobToken,
      });
      return blob.url;
    }

    if (config.isProd) {
      throw new InternalServerErrorException({ code: 'STORAGE_NOT_CONFIGURED', message: 'Image storage is not configured (BLOB_READ_WRITE_TOKEN).' });
    }
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    await fs.writeFile(join(UPLOADS_DIR, name), buf);
    return `/uploads/${name}`;
  }

  async remove(url: string): Promise<void> {
    try {
      if (url.startsWith('/uploads/')) {
        const name = url.slice('/uploads/'.length);
        if (/^[\w-]+\.(jpg|png|webp)$/.test(name)) await fs.rm(join(UPLOADS_DIR, name), { force: true });
      } else if (config.blobToken) {
        await del(url, { token: config.blobToken });
      }
    } catch (err) {
      // Arquivo órfão não deve impedir a exclusão do registro.
      this.logger.warn(`Falha ao remover imagem ${url}: ${(err as Error).message}`);
    }
  }
}
