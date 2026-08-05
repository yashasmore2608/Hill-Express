import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import express from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors();
  app.enableShutdownHooks();

  // ── Uploaded images ───────────────────────────────────────────────────────
  // Mounted with app.use so it sits OUTSIDE URI versioning: an image URL saved
  // in the database must keep working when the API moves to /v2.
  const uploadRoot = resolve(process.cwd(), env.UPLOAD_DIR);
  mkdirSync(uploadRoot, { recursive: true });
  app.use(
    '/uploads',
    express.static(uploadRoot, {
      index: false,
      dotfiles: 'deny',
      immutable: true, // filenames are content-unique, so they never change
      maxAge: '30d',
      setHeaders: (res) => {
        // helmet's default CORP is same-origin, which would block the admin
        // panel on :5173 and the phone on the LAN from loading these at all.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        // Belt and braces on top of nosniff: never let a stored file be
        // interpreted as a document.
        res.setHeader('Content-Disposition', 'inline');
      },
    }),
  );

  // /v1/* from commit one — breaking changes get /v2, old clients keep working.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const swagger = new DocumentBuilder()
    .setTitle('Hill Express API')
    .setDescription('Hyperlocal grocery delivery — customer, driver, POS, and admin surfaces.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(env.PORT);
}

void bootstrap();
