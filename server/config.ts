import { config as loadEnvironment } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

loadEnvironment({ path: join(dirname(fileURLToPath(import.meta.url)), '.env'), quiet: true })

const schema = z.object({
  LOCAL_DATABASE_URL: z.string().min(1).default('postgresql:///vaultbase'),
  MIRROR_DATABASE_URL: z.string().url().optional(),
  VAULTBASE_API_TOKEN: z.string().min(32).optional(),
  VAULTBASE_MASTER_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
  SECRETS_DIRECTORY: z.string().min(1).default('/var/lib/vaultbase/secrets'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8787),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVE_STATIC: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  PUBLIC_ORIGIN: z.string().url().optional(),
  MIRROR_ENABLED: z.enum(['true', 'false']).default('false').transform(value => value === 'true'),
  R2_ENV_FILE: z.string().min(1).default('/etc/vaultbase/r2.env'),
  RESTIC_PASSWORD_FILE: z.string().min(1).default('/etc/vaultbase/restic-password'),
  PG_BIN_DIRECTORY: z.string().min(1).default('/usr/bin'),
  STORAGE_CACHE_DIRECTORY: z.string().min(1).default('/var/lib/vaultbase/storage-cache'),
})

export const config = schema.parse(process.env)
