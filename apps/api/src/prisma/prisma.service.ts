import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { isDbConfigured } from '../config/env';

/**
 * Composition over inheritance so the API still BOOTS with no DATABASE_URL —
 * routes that need the DB return 503 with a readable message instead of the
 * whole process crashing at startup. Scaffold work is never blocked on infra.
 *
 * Reports/exports will later use a second client pointed at a read replica;
 * today both point at the primary, switched by one env var.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  private readonly client: PrismaClient | null = isDbConfigured ? new PrismaClient() : null;

  /** The one way to reach the database. Throws 503 when not configured. */
  get db(): PrismaClient {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Database not configured — set DATABASE_URL in apps/api/.env (see .env.example)',
      );
    }
    return this.client;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async onModuleDestroy() {
    await this.client?.$disconnect();
  }
}
