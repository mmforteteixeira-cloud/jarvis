import { and, desc, eq } from "drizzle-orm";
import {
  generateId,
  NotFoundError,
  ValidationError,
  type Task,
  type TaskLogEntry,
  type TaskPriority,
  type TaskState,
  type AgentType,
} from "@jarvis/shared";
import { getDb } from "../client.js";
import { tasks } from "../schema.js";

export interface CreateTaskInput {
  projectId?: string | null;
  parentTaskId?: string | null;
  description: string;
  priority?: TaskPriority;
  agentType?: AgentType | null;
  input?: unknown;
  dependsOn?: string[];
  maxRetries?: number;
}

const VALID_TRANSITIONS: Record<TaskState, TaskState[]> = {
  PENDING: ["PLANNING", "RUNNING", "CANCELLED"],
  PLANNING: ["RUNNING", "WAITING_APPROVAL", "FAILED", "CANCELLED"],
  RUNNING: ["WAITING_APPROVAL", "COMPLETED", "FAILED", "CANCELLED", "PENDING"],
  WAITING_APPROVAL: ["RUNNING", "PENDING", "CANCELLED", "FAILED"], // PENDING = approval granted, ready to re-run
  COMPLETED: [],
  FAILED: ["PENDING"], // retry
  CANCELLED: [],
};

export function assertValidTransition(from: TaskState, to: TaskState) {
  if (from === to) return;
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new ValidationError(`Invalid task state transition: ${from} -> ${to}`);
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const db = getDb();
  const now = new Date().toISOString();
  const record: Task = {
    id: generateId("task"),
    projectId: input.projectId ?? null,
    parentTaskId: input.parentTaskId ?? null,
    description: input.description,
    priority: input.priority ?? "MEDIUM",
    state: "PENDING",
    agentType: input.agentType ?? null,
    input: input.input ?? null,
    progress: 0,
    dependsOn: input.dependsOn ?? [],
    logs: [],
    result: null,
    error: null,
    retryCount: 0,
    maxRetries: input.maxRetries ?? 3,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(tasks).values(record).run();
  return record;
}

export async function listTasks(filter?: { projectId?: string; state?: TaskState }): Promise<Task[]> {
  const db = getDb();
  const conditions = [];
  if (filter?.projectId) conditions.push(eq(tasks.projectId, filter.projectId));
  if (filter?.state) conditions.push(eq(tasks.state, filter.state));

  const rows =
    conditions.length > 0
      ? db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.updatedAt)).all()
      : db.select().from(tasks).orderBy(desc(tasks.updatedAt)).all();
  return rows as Task[];
}

export async function getTask(id: string): Promise<Task | undefined> {
  const db = getDb();
  return db.select().from(tasks).where(eq(tasks.id, id)).get() as Task | undefined;
}

export async function appendTaskLog(id: string, entry: Omit<TaskLogEntry, "timestamp">): Promise<Task> {
  const db = getDb();
  const existing = await getTask(id);
  if (!existing) throw new NotFoundError("Task", id);
  const logs = [...existing.logs, { ...entry, timestamp: new Date().toISOString() }];
  const updatedAt = new Date().toISOString();
  db.update(tasks).set({ logs, updatedAt }).where(eq(tasks.id, id)).run();
  return { ...existing, logs, updatedAt };
}

export interface UpdateTaskInput {
  state?: TaskState;
  progress?: number;
  result?: unknown;
  error?: string | null;
  agentType?: AgentType | null;
  retryCount?: number;
}

export async function updateTask(id: string, patch: UpdateTaskInput): Promise<Task> {
  const db = getDb();
  const existing = await getTask(id);
  if (!existing) throw new NotFoundError("Task", id);

  if (patch.state) {
    assertValidTransition(existing.state, patch.state);
  }

  const updatedAt = new Date().toISOString();
  const next: Task = { ...existing, ...patch, updatedAt };
  db
    .update(tasks)
    .set({
      state: next.state,
      progress: next.progress,
      result: next.result,
      error: next.error,
      agentType: next.agentType,
      retryCount: next.retryCount,
      updatedAt,
    })
    .where(eq(tasks.id, id))
    .run();
  return next;
}

export async function cancelTask(id: string): Promise<Task> {
  return updateTask(id, { state: "CANCELLED" });
}

export async function retryTask(id: string): Promise<Task> {
  const db = getDb();
  const existing = await getTask(id);
  if (!existing) throw new NotFoundError("Task", id);
  if (existing.state !== "FAILED") {
    throw new ValidationError(`Only FAILED tasks can be retried (current state: ${existing.state})`);
  }
  if (existing.retryCount >= existing.maxRetries) {
    throw new ValidationError(`Task ${id} has exhausted its retry budget (${existing.maxRetries})`);
  }
  return updateTask(id, { state: "PENDING", retryCount: existing.retryCount + 1, error: null });
}

export async function deleteTask(id: string): Promise<void> {
  const db = getDb();
  db.delete(tasks).where(eq(tasks.id, id)).run();
}
