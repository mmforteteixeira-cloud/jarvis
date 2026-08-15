/**
 * JARVIS database schema (SQLite dialect, via Drizzle ORM).
 *
 * This is the zero-cost local-development storage layer: a single file on
 * disk, no server to run. The table shapes are intentionally
 * Postgres-portable (text ids, ISO-string timestamps, JSON-as-text) so
 * moving to Postgres/Supabase later is a driver swap, not a redesign — see
 * ARCHITECTURE.md "Database" section.
 */
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  ...timestamps,
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    goal: text("goal").notNull().default(""),
    status: text("status").notNull().default("PLANNING"),
    priority: text("priority").notNull().default("MEDIUM"),
    ...timestamps,
  },
  (t) => ({
    userIdx: index("projects_user_idx").on(t.userId),
  }),
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id"),
    parentTaskId: text("parent_task_id"),
    description: text("description").notNull(),
    priority: text("priority").notNull().default("MEDIUM"),
    state: text("state").notNull().default("PENDING"),
    agentType: text("agent_type"),
    input: text("input", { mode: "json" }).$type<unknown>(),
    progress: integer("progress").notNull().default(0),
    dependsOn: text("depends_on", { mode: "json" }).$type<string[]>().notNull().default([]),
    logs: text("logs", { mode: "json" }).$type<Array<{ timestamp: string; level: string; message: string; data?: unknown }>>().notNull().default([]),
    result: text("result", { mode: "json" }).$type<unknown>(),
    error: text("error"),
    retryCount: integer("retry_count").notNull().default(0),
    maxRetries: integer("max_retries").notNull().default(3),
    ...timestamps,
  },
  (t) => ({
    projectIdx: index("tasks_project_idx").on(t.projectId),
    stateIdx: index("tasks_state_idx").on(t.state),
  }),
);

export const agents = sqliteTable("agents", {
  type: text("type").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("IDLE"),
  capabilities: text("capabilities", { mode: "json" }).$type<string[]>().notNull().default([]),
  plannedCapabilities: text("planned_capabilities", { mode: "json" }).$type<string[]>().notNull().default([]),
  updatedAt: text("updated_at").notNull(),
});

export const agentRuns = sqliteTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull(),
    agentType: text("agent_type").notNull(),
    status: text("status").notNull().default("RUNNING"),
    input: text("input", { mode: "json" }).$type<unknown>(),
    output: text("output", { mode: "json" }).$type<unknown>(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<unknown[]>().notNull().default([]),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    error: text("error"),
  },
  (t) => ({
    taskIdx: index("agent_runs_task_idx").on(t.taskId),
  }),
);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull().default("New conversation"),
  ...timestamps,
});

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    toolCalls: text("tool_calls", { mode: "json" }).$type<unknown[]>(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    conversationIdx: index("messages_conversation_idx").on(t.conversationId),
  }),
);

export const memories = sqliteTable(
  "memories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    projectId: text("project_id"),
    taskId: text("task_id"),
    content: text("content").notNull(),
    metadata: text("metadata", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
    importance: real("importance").notNull().default(0.5),
    ...timestamps,
  },
  (t) => ({
    userIdx: index("memories_user_idx").on(t.userId),
    typeIdx: index("memories_type_idx").on(t.type),
    projectIdx: index("memories_project_idx").on(t.projectId),
  }),
);

export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("NOT_CONNECTED"),
  mode: text("mode").notNull().default("NOT_CONFIGURED"),
  detail: text("detail").notNull().default(""),
  configuredEnvVars: text("configured_env_vars", { mode: "json" }).$type<string[]>().notNull().default([]),
  missingEnvVars: text("missing_env_vars", { mode: "json" }).$type<string[]>().notNull().default([]),
  updatedAt: text("updated_at").notNull(),
});

export const permissions = sqliteTable(
  "permissions",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id"),
    agentType: text("agent_type"),
    action: text("action").notNull(),
    riskLevel: text("risk_level").notNull(),
    reason: text("reason").notNull().default(""),
    state: text("state").notNull().default("PENDING"),
    requestedAt: text("requested_at").notNull(),
    resolvedAt: text("resolved_at"),
    resolvedBy: text("resolved_by"),
  },
  (t) => ({
    stateIdx: index("permissions_state_idx").on(t.state),
    taskIdx: index("permissions_task_idx").on(t.taskId),
  }),
);

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: text("id").primaryKey(),
    timestamp: text("timestamp").notNull(),
    agentType: text("agent_type").notNull(),
    toolName: text("tool_name"),
    action: text("action").notNull(),
    result: text("result").notNull(),
    durationMs: integer("duration_ms"),
    taskId: text("task_id"),
    projectId: text("project_id"),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => ({
    timestampIdx: index("activity_logs_timestamp_idx").on(t.timestamp),
    taskIdx: index("activity_logs_task_idx").on(t.taskId),
  }),
);

export const devices = sqliteTable("devices", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  platform: text("platform").notNull(),
  status: text("status").notNull().default("PENDING_PAIRING"),
  lastSeenAt: text("last_seen_at"),
  createdAt: text("created_at").notNull(),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    message: text("message").notNull(),
    severity: text("severity").notNull().default("info"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    taskId: text("task_id"),
    projectId: text("project_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    userIdx: index("notifications_user_idx").on(t.userId),
  }),
);

export const content = sqliteTable("content", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  title: text("title").notNull(),
  platform: text("platform").notNull().default("generic"),
  script: text("script").notNull().default(""),
  hashtags: text("hashtags", { mode: "json" }).$type<string[]>().notNull().default([]),
  state: text("state").notNull().default("DRAFT"),
  ...timestamps,
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).$type<unknown>(),
  updatedAt: text("updated_at").notNull(),
});
