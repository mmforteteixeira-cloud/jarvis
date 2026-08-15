import { existsSync, mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { createLogger } from "@jarvis/shared";
import * as schema from "./schema.js";
import { INIT_SQL } from "./migrations/0000_init.js";
import { applyComputerAgentMigrations } from "./migrations/0001_computer_agent.js";
import { applyReminderMigrations } from "./migrations/0002_reminders.js";

const logger = createLogger("db");

/**
 * Walks up from this file to find the monorepo root (marked by
 * pnpm-workspace.yaml), so a relative DATABASE_URL resolves to the same
 * physical file no matter which app (web, worker, db CLI) opens it.
 */
function findMonorepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function resolveSqlitePath(databaseUrl: string): string {
  const raw = databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl;
  if (isAbsolute(raw)) return raw;
  const here = dirname(fileURLToPath(import.meta.url));
  const root = findMonorepoRoot(here);
  return resolve(root, raw);
}

let instance: BetterSQLite3Database<typeof schema> | null = null;
let rawInstance: Database.Database | null = null;

/**
 * Returns a singleton Drizzle client backed by SQLite (local, zero-cost).
 *
 * To move to Postgres/Supabase in production: point DATABASE_URL at a
 * postgres:// connection string and swap this factory for
 * `drizzle-orm/node-postgres` against the mirrored schema in
 * `schema.postgres.ts`. Every repository in `packages/db/src/repositories`
 * is written against Drizzle's query builder, which is dialect-agnostic at
 * the call-site — see ARCHITECTURE.md.
 */
export function getDb(): BetterSQLite3Database<typeof schema> {
  if (instance) return instance;

  const databaseUrl = process.env.DATABASE_URL ?? "file:./data/jarvis.db";

  if (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://")) {
    throw new Error(
      "DATABASE_URL points at Postgres, but the Postgres driver is not wired into the running app yet. " +
        "See packages/db/src/schema.postgres.ts and ARCHITECTURE.md for the migration path. " +
        "Use a file: DATABASE_URL for local development.",
    );
  }

  // In-memory mode (used by tests): bypass path resolution entirely.
  const isMemory = databaseUrl === ":memory:" || databaseUrl === "file::memory:";
  const absolutePath = isMemory ? ":memory:" : resolveSqlitePath(databaseUrl);
  if (!isMemory) {
    const dir = dirname(absolutePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  rawInstance = new Database(absolutePath);
  rawInstance.pragma("journal_mode = WAL");
  rawInstance.pragma("foreign_keys = ON");

  bootstrap(rawInstance);

  instance = drizzle(rawInstance, { schema });
  logger.info("SQLite database ready", { path: absolutePath });
  return instance;
}

function bootstrap(db: Database.Database) {
  db.exec(INIT_SQL);
  applyComputerAgentMigrations(db);
  applyReminderMigrations(db);
}

/** Closes the underlying SQLite connection. Mainly useful for tests. */
export function closeDb(): void {
  rawInstance?.close();
  rawInstance = null;
  instance = null;
}
