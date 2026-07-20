import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LogLevel, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { S3Service } from './module/media/s3.service';

async function bootstrap() {
  const logLevels = (process.env.NEST_LOG_LEVELS || 'warn,error')
    .split(',')
    .map((level) => level.trim())
    .filter(Boolean) as LogLevel[];

  const app = await NestFactory.create(AppModule, {
    logger: logLevels.length ? logLevels : ['warn', 'error'],
  });
  const rawExpress = app.getHttpAdapter().getInstance();

  // Security headers
  rawExpress.use(helmet());

  // Compression (free-tier friendly, reduces bandwidth)
  rawExpress.use(compression());

  // Base64 upload payload can be larger than default parser limit (~100kb).
  rawExpress.use(express.json({ limit: '25mb' }));
  rawExpress.use(express.urlencoded({ extended: true, limit: '25mb' }));

  const FRONTEND_URL = process.env.FRONTEND_URL || '';
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:5173',
        'http://localhost:19006',
        'http://localhost:8088',
        ...(FRONTEND_URL ? [FRONTEND_URL] : []),
      ].filter(Boolean);

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
  });

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());

  app.useWebSocketAdapter(new IoAdapter(app));

  const s3Service = app.get(S3Service);

  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }

  // Serve local uploads first. If S3 is available, use it as fallback.
  rawExpress.use('/uploads', express.static(uploadsRoot));

  if (s3Service.isAvailable) {
    rawExpress.use('/uploads', async (req, res) => {
      const key = `uploads${req.path}`;
      try {
        const result = await s3Service.getObjectStream(key);
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        if (result.ContentType) res.setHeader('Content-Type', result.ContentType);
        if (result.ContentLength) res.setHeader('Content-Length', String(result.ContentLength));
        const bodyStream = result.Body as any;
        if (bodyStream) {
          bodyStream.pipe(res);
          bodyStream.on('error', (err: Error) => {
            console.error('S3 stream error for', key, err);
            if (!res.headersSent) res.status(502).end();
          });
        } else {
          res.status(404).end();
        }
      } catch (err: any) {
        if (err?.name === 'NoSuchKey') {
          console.warn('S3 object not found:', key);
          res.status(404).json({ error: 'File not found' });
        } else {
          console.error('S3 proxy error for', key, err);
          res.status(502).json({ error: 'Storage backend error' });
        }
      }
    });
  }

  const port = process.env.PORT || process.env.API_PORT || 5007;

  // Graceful shutdown
  app.enableShutdownHooks();

  await app.listen(port);
  console.log(`Server running on http://localhost:${port}`);
}

// Process-level error handlers (prevent crashes on unhandled rejections)
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

void bootstrap();
