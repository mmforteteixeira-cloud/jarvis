/**
 * Shared domain types used across every JARVIS package (core, db, agents,
 * tools, apps). Keeping these in one place is what lets the orchestrator,
 * the task engine, the agents and the UI all agree on the same shapes.
 */

// ---------------------------------------------------------------------------
// Task Engine
// ---------------------------------------------------------------------------

export const TASK_STATES = [
  "PENDING",
  "PLANNING",
  "RUNNING",
  "WAITING_APPROVAL",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type TaskState = (typeof TASK_STATES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const AGENT_TYPES = [
  "DEVELOPER",
  "RESEARCH",
  "BROWSER",
  "FILE",
  "COMPUTER",
  "EMAIL",
  "CONTENT",
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export interface TaskLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: unknown;
}

export interface Task {
  id: string;
  projectId: string | null;
  parentTaskId: string | null;
  description: string;
  priority: TaskPriority;
  state: TaskState;
  agentType: AgentType | null;
  /** Structured input for the assigned agent, e.g. { op: "read", path: "x" }.
   * Null for plan-level tasks that describe a step but aren't wired to a
   * concrete tool call yet. */
  input: unknown;
  progress: number; // 0-100
  dependsOn: string[];
  logs: TaskLogEntry[];
  result: unknown;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Project System
// ---------------------------------------------------------------------------

export const PROJECT_STATES = [
  "PLANNING",
  "IN_PROGRESS",
  "TESTING",
  "WAITING",
  "COMPLETED",
  "FAILED",
  "ARCHIVED",
] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string;
  goal: string;
  status: ProjectState;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export const MEMORY_TYPES = [
  "SHORT_TERM",
  "PROJECT",
  "TASK",
  "USER_PREFERENCE",
  "LONG_TERM",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export interface Memory {
  id: string;
  userId: string;
  type: MemoryType;
  projectId: string | null;
  taskId: string | null;
  content: string;
  metadata: Record<string, unknown>;
  importance: number; // 0-1, used for pruning/ranking
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Conversations / Messages
// ---------------------------------------------------------------------------

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Reminders / Automations
// ---------------------------------------------------------------------------

export type ReminderStatus = "PENDING" | "FIRED" | "CANCELLED";

export interface Reminder {
  id: string;
  userId: string;
  message: string;
  dueAt: string;
  status: ReminderStatus;
  createdAt: string;
  firedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Tools / Agents
// ---------------------------------------------------------------------------

export const RISK_LEVELS = ["LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export interface ToolCall {
  id: string;
  toolName: string;
  input: unknown;
  riskLevel: RiskLevel;
}

export interface ToolResult {
  toolCallId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

export const AGENT_STATUSES = ["IDLE", "WORKING", "ERROR", "NOT_CONNECTED", "NOT_CONFIGURED"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export interface AgentDescriptor {
  type: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  plannedCapabilities: string[];
}

export interface AgentRun {
  id: string;
  taskId: string;
  agentType: AgentType;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  input: unknown;
  output: unknown;
  toolCalls: ToolCall[];
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Permissions / Security
// ---------------------------------------------------------------------------

export const PERMISSION_STATES = ["PENDING", "APPROVED", "DENIED", "EXPIRED"] as const;
export type PermissionState = (typeof PERMISSION_STATES)[number];

export interface PermissionRequest {
  id: string;
  taskId: string | null;
  agentType: AgentType | null;
  action: string;
  riskLevel: RiskLevel;
  reason: string;
  state: PermissionState;
  requestedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

// ---------------------------------------------------------------------------
// Activity Log
// ---------------------------------------------------------------------------

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  agentType: AgentType | "SYSTEM" | "ORCHESTRATOR";
  toolName: string | null;
  action: string;
  result: "SUCCESS" | "FAILURE" | "PENDING";
  durationMs: number | null;
  taskId: string | null;
  projectId: string | null;
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------

export const INTEGRATION_STATUSES = [
  "CONNECTED",
  "NOT_CONNECTED",
  "ERROR",
  "CONFIGURATION_REQUIRED",
] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const INTEGRATION_CATEGORIES = [
  "AI",
  "VOICE",
  "EMAIL",
  "TIKTOK",
  "GITHUB",
  "BROWSER",
  "COMPUTER",
  "DATABASE",
  "SEARCH",
  "WEATHER",
  "NEWS",
] as const;
export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[number];

export interface IntegrationDescriptor {
  id: string;
  category: IntegrationCategory;
  name: string;
  status: IntegrationStatus;
  mode: "REAL" | "DEMO" | "NOT_CONFIGURED";
  detail: string;
  configuredEnvVars: string[];
  missingEnvVars: string[];
}

// ---------------------------------------------------------------------------
// Devices (Computer Agent)
// ---------------------------------------------------------------------------

export const DEVICE_STATUSES = ["ONLINE", "OFFLINE", "CONNECTING", "ERROR", "BUSY", "PENDING_PAIRING"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export interface Device {
  id: string;
  userId: string;
  /** Stable identifier generated and persisted by the daemon itself
   * (~/.jarvis/device.json), sent on every register/heartbeat call — lets
   * the daemon re-register idempotently across restarts instead of
   * creating a duplicate row every time it starts up. Empty string for
   * devices registered the old (manual, v0.1) way. */
  externalId: string;
  name: string;
  /** Operating system identifier, e.g. "darwin" — kept as "platform" since
   * that's the field name v0.1's manual pairing flow already uses. */
  platform: string;
  architecture: string;
  agentVersion: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Computer Agent — command protocol (packages/agents/src/computer-protocol.ts
// is the authoritative documentation of the wire format; these are the
// persisted-record shapes shared between the server and the daemon client).
// ---------------------------------------------------------------------------

export const COMPUTER_COMMAND_TYPES = [
  "SYSTEM_INFO",
  "OPEN_APPLICATION",
  "OPEN_URL",
  "SCREENSHOT",
  "LIST_DIRECTORY",
  "READ_FILE",
  "WRITE_FILE",
  "CREATE_DIRECTORY",
  "RUN_COMMAND",
] as const;
export type ComputerCommandType = (typeof COMPUTER_COMMAND_TYPES)[number];

export const COMPUTER_COMMAND_STATES = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
  "EXPIRED",
] as const;
export type ComputerCommandState = (typeof COMPUTER_COMMAND_STATES)[number];

export interface ComputerCommandRecord {
  id: string;
  deviceId: string;
  taskId: string | null;
  type: ComputerCommandType;
  payload: Record<string, unknown>;
  riskLevel: RiskLevel;
  state: ComputerCommandState;
  result: unknown;
  error: string | null;
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationSeverity = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  read: boolean;
  taskId: string | null;
  projectId: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export const CONTENT_STATES = ["DRAFT", "READY", "PUBLISHED", "FAILED"] as const;
export type ContentState = (typeof CONTENT_STATES)[number];

export interface ContentItem {
  id: string;
  projectId: string | null;
  title: string;
  platform: "tiktok" | "generic";
  script: string;
  hashtags: string[];
  state: ContentState;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// JARVIS status
// ---------------------------------------------------------------------------

export type JarvisStatus = "ONLINE" | "BUSY" | "OFFLINE";
