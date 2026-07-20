import { Injectable } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private client: S3Client | null = null;
  private bucket: string = '';
  private region: string = '';

  constructor() {
    const region = process.env.AWS_REGION || '';
    const bucket = process.env.AWS_S3_BUCKET || '';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';

    if (region && bucket && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.bucket = bucket;
      this.region = region;
    }
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  async upload(
    buffer: Buffer,
    key: string,
    contentType?: string,
  ): Promise<void> {
    if (!this.client) throw new Error('S3 not configured');

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
      }),
    );
  }

  async getObjectStream(key: string) {
    if (!this.client) throw new Error('S3 not configured');

    return this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async headObject(key: string) {
    if (!this.client) throw new Error('S3 not configured');
    await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
