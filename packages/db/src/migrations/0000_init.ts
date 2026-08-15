// Kept as a TS module (not a loose .sql file) so `tsc` bundles it into
// dist/ automatically — a raw asset file would otherwise be silently
// dropped by the build and break migrations in production.
export const INIT_SQL = `
-- JARVIS initial schema bootstrap (idempotent).
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PLANNING',
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS projects_user_idx ON projects(user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  parent_task_id TEXT,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'MEDIUM',
  state TEXT NOT NULL DEFAULT 'PENDING',
  agent_type TEXT,
  input TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  depends_on TEXT NOT NULL DEFAULT '[]',
  logs TEXT NOT NULL DEFAULT '[]',
  result TEXT,
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_project_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_state_idx ON tasks(state);

CREATE TABLE IF NOT EXISTS agents (
  type TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'IDLE',
  capabilities TEXT NOT NULL DEFAULT '[]',
  planned_capabilities TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING',
  input TEXT,
  output TEXT,
  tool_calls TEXT NOT NULL DEFAULT '[]',
  started_at TEXT NOT NULL,
  finished_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS agent_runs_task_idx ON agent_runs(task_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  project_id TEXT,
  task_id TEXT,
  content TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  importance REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS memories_user_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_type_idx ON memories(type);
CREATE INDEX IF NOT EXISTS memories_project_idx ON memories(project_id);

CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
  mode TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  detail TEXT NOT NULL DEFAULT '',
  configured_env_vars TEXT NOT NULL DEFAULT '[]',
  missing_env_vars TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  agent_type TEXT,
  action TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT 'PENDING',
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT
);
CREATE INDEX IF NOT EXISTS permissions_state_idx ON permissions(state);
CREATE INDEX IF NOT EXISTS permissions_task_idx ON permissions(task_id);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  tool_name TEXT,
  action TEXT NOT NULL,
  result TEXT NOT NULL,
  duration_ms INTEGER,
  task_id TEXT,
  project_id TEXT,
  details TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS activity_logs_timestamp_idx ON activity_logs(timestamp);
CREATE INDEX IF NOT EXISTS activity_logs_task_idx ON activity_logs(task_id);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_PAIRING',
  last_seen_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  read INTEGER NOT NULL DEFAULT 0,
  task_id TEXT,
  project_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  title TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'generic',
  script TEXT NOT NULL DEFAULT '',
  hashtags TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TEXT NOT NULL
);
`;
