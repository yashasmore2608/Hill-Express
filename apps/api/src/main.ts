import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors();
  app.enableShutdownHooks();

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
