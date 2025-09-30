import { z } from 'zod';
import { MIN_ADMIN_KEY_LENGTH } from './constants';

/**
 * Every environment variable the process reads is declared here and nowhere else.
 * A missing or malformed value fails at startup with a readable message rather than
 * surfacing as `undefined` inside a request handler.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(7331),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  ADMIN_API_KEY: z
    .string()
    .min(MIN_ADMIN_KEY_LENGTH, `ADMIN_API_KEY must be at least ${MIN_ADMIN_KEY_LENGTH} characters`),
  REQUEST_LOG: z.enum(['dev', 'combined', 'off']).default('dev'),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Parsed once per process. Tests call `parseEnv` directly with a literal object instead. */
export function env(): Env {
  if (!cached) cached = parseEnv();
  return cached;
}
