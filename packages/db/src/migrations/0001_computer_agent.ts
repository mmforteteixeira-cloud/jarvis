import type Database from "better-sqlite3";

// New table for v0.2 — safe on both fresh and existing databases.
export const COMPUTER_COMMANDS_SQL = `
CREATE TABLE IF NOT EXISTS computer_commands (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  task_id TEXT,
  type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  risk_level TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'PENDING',
  result TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS computer_commands_device_state_idx ON computer_commands(device_id, state);
CREATE INDEX IF NOT EXISTS computer_commands_task_idx ON computer_commands(task_id);
`;

interface ColumnMigration {
  table: string;
  column: string;
  ddl: string;
}

// v0.1's `devices` table predates these columns. `CREATE TABLE IF NOT
// EXISTS` (in 0000_init.ts) is a no-op against an already-existing table,
// so an existing database's `devices` table needs these added explicitly.
// Guarded by PRAGMA table_info so this is safe to run on every startup,
// against both a fresh database (columns already exist from schema.ts's
// CREATE TABLE — this becomes a no-op) and an old one (columns get added).
const DEVICE_COLUMN_MIGRATIONS: ColumnMigration[] = [
  { table: "devices", column: "external_id", ddl: "ALTER TABLE devices ADD COLUMN external_id TEXT NOT NULL DEFAULT ''" },
  { table: "devices", column: "architecture", ddl: "ALTER TABLE devices ADD COLUMN architecture TEXT NOT NULL DEFAULT ''" },
  { table: "devices", column: "agent_version", ddl: "ALTER TABLE devices ADD COLUMN agent_version TEXT NOT NULL DEFAULT ''" },
];

export function applyComputerAgentMigrations(db: Database.Database): void {
  db.exec(COMPUTER_COMMANDS_SQL);

  const existingColumns = new Set(
    (db.prepare("PRAGMA table_info(devices)").all() as Array<{ name: string }>).map((c) => c.name),
  );
  for (const migration of DEVICE_COLUMN_MIGRATIONS) {
    if (!existingColumns.has(migration.column)) {
      db.exec(migration.ddl);
    }
  }

  db.exec("CREATE INDEX IF NOT EXISTS devices_external_id_idx ON devices(external_id)");
}
