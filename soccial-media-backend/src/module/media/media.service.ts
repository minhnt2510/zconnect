import { BadRequestException, Injectable } from '@nestjs/common';
import { extname, join } from 'path';
import { promises as fs } from 'fs';
import { S3Service } from './s3.service';

export type MediaType = 'post' | 'avatar' | 'cover' | 'message';

export interface UploadResult {
  fileUrl: string;
  fileName: string;
  size: number;
}

@Injectable()
export class MediaService {
  constructor(private readonly s3: S3Service) {}

  private readonly typeConfig: Record<
    MediaType,
    { maxSize: number; allowedExtensions: string[]; subDir: string }
  > = {
    post: {
      maxSize: 10 * 1024 * 1024,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4'],
      subDir: 'posts',
    },
    avatar: {
      maxSize: 6 * 1024 * 1024,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      subDir: 'avatars',
    },
    cover: {
      maxSize: 10 * 1024 * 1024,
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
      subDir: 'covers',
    },
    message: {
      maxSize: 15 * 1024 * 1024,
      allowedExtensions: [
        '.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4',
        '.pdf', '.json', '.zip', '.bin',
      ],
      subDir: 'messages',
    },
  };

  async uploadBase64(
    userId: number,
    mediaType: MediaType,
    body: { fileName?: string; contentType?: string; base64Data?: string },
  ): Promise<UploadResult> {
    const config = this.typeConfig[mediaType];

    const base64Raw = String(body?.base64Data || '').trim();
    if (!base64Raw) {
      throw new BadRequestException('Thieu base64Data');
    }

    const base64Payload = base64Raw.includes(',')
      ? base64Raw.split(',').pop() || ''
      : base64Raw;

    const buffer = Buffer.from(base64Payload, 'base64');
    if (!buffer.length) {
      throw new BadRequestException('Du lieu media khong hop le');
    }
    if (buffer.length > config.maxSize) {
      throw new BadRequestException(
        `Kich thuoc file qua lon (toi da ${config.maxSize / 1024 / 1024}MB)`,
      );
    }

    const requestedExt = extname(String(body?.fileName || '')).toLowerCase();
    const fileExt = config.allowedExtensions.includes(requestedExt)
      ? requestedExt
      : config.allowedExtensions.includes(
            '.' + String(body?.contentType || '').split('/').pop(),
          )
        ? '.' + String(body?.contentType || '').split('/').pop()
        : this.fallbackExtension(body?.contentType);

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${fileExt}`;
    const relativeDir = join('uploads', config.subDir, String(userId));
    const absoluteDir = join(process.cwd(), relativeDir);
    await fs.mkdir(absoluteDir, { recursive: true });

    // Always save to local disk first (survives S3 outages, works offline)
    const absolutePath = join(absoluteDir, fileName);
    await fs.writeFile(absolutePath, buffer);

    // If S3 is available, sync the file to S3 as additional storage
    if (this.s3.isAvailable) {
      const key = `${relativeDir.replace(/\\/g, '/')}/${fileName}`;
      try {
        await this.s3.upload(buffer, key, body?.contentType);
      } catch (err) {
        console.error(`S3 upload failed for ${key}, file saved locally:`, err);
      }
    }

    const fileUrl = `/${relativeDir.replace(/\\/g, '/')}/${fileName}`;
    return { fileUrl, fileName, size: buffer.length };
  }

  private fallbackExtension(contentType?: string): string {
    const ct = String(contentType || '').toLowerCase();
    if (ct.includes('png')) return '.png';
    if (ct.includes('gif')) return '.gif';
    if (ct.includes('webp')) return '.webp';
    if (ct.includes('mp4')) return '.mp4';
    return '.jpg';
  }
}
