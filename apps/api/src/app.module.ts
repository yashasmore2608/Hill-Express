import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { CartModule } from './cart/cart.module';
import { AddressesModule } from './addresses/addresses.module';
import { PosModule } from './pos/pos.module';
import { OrdersModule } from './orders/orders.module';
import { DriversModule } from './drivers/drivers.module';
import { AdminModule } from './admin/admin.module';
import { BannersModule } from './banners/banners.module';
import { UploadsModule } from './uploads/uploads.module';
import { env } from './config/env';

@Module({
  imports: [
    // Structured JSON logs with a requestId on every line, from M0.
    // Retrofitting this after a production incident is miserable.
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
        transport:
          env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization'],
      },
    }),
    PrismaModule,
    AuthModule,
    CatalogModule,
    CartModule,
    AddressesModule,
    PosModule,
    OrdersModule,
    DriversModule,
    AdminModule,
    BannersModule,
    UploadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
