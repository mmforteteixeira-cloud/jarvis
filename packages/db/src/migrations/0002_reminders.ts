import type Database from "better-sqlite3";

// New table for v0.3 — safe on both fresh and existing databases.
export const REMINDERS_SQL = `
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  fired_at TEXT
);
CREATE INDEX IF NOT EXISTS reminders_user_idx ON reminders(user_id);
CREATE INDEX IF NOT EXISTS reminders_status_due_idx ON reminders(status, due_at);
`;

export function applyReminderMigrations(db: Database.Database): void {
  db.exec(REMINDERS_SQL);
}
