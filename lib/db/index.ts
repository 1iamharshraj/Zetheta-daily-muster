import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const g = globalThis as unknown as { __musterPool?: Pool };

// pg connects lazily, so constructing the pool at import time is safe during `next build`.
// Neon URLs carry sslmode=require, which pg honours.
export const pool = g.__musterPool ?? (g.__musterPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }));
export const db = drizzle(pool, { schema });
export * as t from './schema';
