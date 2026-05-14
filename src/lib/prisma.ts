import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ── Singleton pool — shared across all hot-reloads in dev ─────────────────────
const globalForPool = globalThis as unknown as { pgPool: Pool; prisma: PrismaClient };

function createPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL as string,
    // Neon uses TLS on its pooler endpoint. The Node pg driver cannot verify
    // Neon's certificate chain by default, so we keep the connection encrypted
    // but skip CA verification. This is the standard fix for Neon + pg.
    ssl: { rejectUnauthorized: false },
    // Keep the pool small so we never exhaust the DB's connection limit.
    // Neon/Supabase free tiers typically allow ~10–20 simultaneous connections.
    max: 8,
    // Kill idle connections after 30 s to avoid stale-connection errors.
    idleTimeoutMillis: 30_000,
    // If no connection is available within 15 s, throw rather than hanging forever.
    connectionTimeoutMillis: 15_000,
    // Keep-alive pings so the DB proxy doesn't silently drop idle connections.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });
}

function createPrismaClient(pool: Pool): PrismaClient {
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

// Reuse across Next.js dev hot-reloads
const pool   = globalForPool.pgPool   ?? createPool();
export const prisma = globalForPool.prisma ?? createPrismaClient(pool);

if (process.env.NODE_ENV !== "production") {
  globalForPool.pgPool  = pool;
  globalForPool.prisma  = prisma;
}
