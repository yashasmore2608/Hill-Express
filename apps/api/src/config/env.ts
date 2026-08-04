import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Load .env HERE, not via a runner flag — `nest start --watch`, `node
// dist/main.js`, and any script all reach this module first, so every entry
// point gets the same environment. (Resolved from the package root so the
// watcher's cwd can't change the answer.)
loadDotenv({ path: resolve(__dirname, '../../.env'), quiet: true });

/**
 * Environment is validated ONCE at boot with zod. A missing required var is a
 * crash at startup with a readable message — never an undefined at 2 a.m.
 * DATABASE_URL/REDIS_URL are optional so the scaffold boots before infra exists;
 * modules that need them check `isDbConfigured`/`isRedisConfigured`.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().url().optional().or(z.literal('')),
  REDIS_URL: z.string().url().optional().or(z.literal('')),
  JWT_ACCESS_SECRET: z.string().min(32).optional().or(z.literal('')),
  JWT_REFRESH_SECRET: z.string().min(32).optional().or(z.literal('')),
  /**
   * DEV ONLY. Treat every pincode as serviceable (falls back to the first
   * active zone) so the whole order flow can be tested from any address.
   * MUST be unset in production — it would let customers order from
   * anywhere in the country.
   */
  SERVICE_ALL_PINCODES: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isDbConfigured = Boolean(env.DATABASE_URL);
export const isRedisConfigured = Boolean(env.REDIS_URL);
