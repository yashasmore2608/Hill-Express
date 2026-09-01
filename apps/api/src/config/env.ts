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
  /**
   * DEMO ONLY. Return the login OTP in the API response even in production,
   * so a deployed build can be signed into before an SMS provider exists.
   *
   * This is an AUTHENTICATION BYPASS: anyone who can reach the API can request
   * a code for any phone number and read it straight back, which means they can
   * sign in as anyone. Acceptable only while the URL is private and the data is
   * seed data. MUST be unset before real customers exist.
   */
  DEMO_MODE: z
    .enum(['true', 'false'])
    .optional()
    // An empty value is how .env.example ships it and how a blank Render field
    // arrives — both mean "off", not "crash at boot".
    .or(z.literal(''))
    .transform((v) => v === 'true'),
  /**
   * Where uploaded images live. Relative paths resolve from the API package
   * root, so the default works in dev with no configuration. In Docker this
   * points at a mounted volume — uploads must survive a container rebuild.
   */
  UPLOAD_DIR: z.string().default('uploads'),
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
