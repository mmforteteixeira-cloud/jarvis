import { and, desc, eq, lt } from "drizzle-orm";
import {
  generateId,
  NotFoundError,
  type ComputerCommandRecord,
  type ComputerCommandType,
  type RiskLevel,
} from "@jarvis/shared";
import { getDb } from "../client.js";
import { computerCommands, devices } from "../schema.js";

export interface CreateComputerCommandInput {
  deviceId: string;
  taskId?: string | null;
  type: ComputerCommandType;
  payload: Record<string, unknown>;
  riskLevel: RiskLevel;
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 60_000;

export async function createComputerCommand(input: CreateComputerCommandInput): Promise<ComputerCommandRecord> {
  const db = getDb();
  const now = new Date();
  const record: ComputerCommandRecord = {
    id: generateId("cmd"),
    deviceId: input.deviceId,
    taskId: input.taskId ?? null,
    type: input.type,
    payload: input.payload,
    riskLevel: input.riskLevel,
    state: "PENDING",
    result: null,
    error: null,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_TTL_MS)).toISOString(),
    startedAt: null,
    completedAt: null,
  };
  db.insert(computerCommands).values(record).run();
  return record;
}

/** Marks any PENDING command past its expiresAt as EXPIRED. Called before
 * claiming (so a slow/offline daemon never claims stale work) and can be
 * called by anyone polling command state. */
export async function expireStaleCommands(deviceId: string): Promise<void> {
  const db = getDb();
  const nowIso = new Date().toISOString();
  db
    .update(computerCommands)
    .set({ state: "EXPIRED", completedAt: nowIso, error: "Command expired before the daemon picked it up." })
    .where(and(eq(computerCommands.deviceId, deviceId), eq(computerCommands.state, "PENDING"), lt(computerCommands.expiresAt, nowIso)))
    .run();
}

/** Atomically claims the oldest PENDING command for a device (transitions
 * it to RUNNING) so two concurrent polls never both grab the same command. */
export async function claimNextComputerCommand(deviceId: string): Promise<ComputerCommandRecord | undefined> {
  const db = getDb();
  await expireStaleCommands(deviceId);

  const next = db
    .select()
    .from(computerCommands)
    .where(and(eq(computerCommands.deviceId, deviceId), eq(computerCommands.state, "PENDING")))
    .orderBy(computerCommands.createdAt)
    .get();
  if (!next) return undefined;

  const startedAt = new Date().toISOString();
  const claimed = db
    .update(computerCommands)
    .set({ state: "RUNNING", startedAt })
    .where(and(eq(computerCommands.id, next.id), eq(computerCommands.state, "PENDING")))
    .run();
  if (claimed.changes === 0) return undefined; // lost the race to another poller

  return { ...(next as ComputerCommandRecord), state: "RUNNING", startedAt };
}

export interface ResolveComputerCommandInput {
  state: "COMPLETED" | "FAILED" | "REJECTED";
  result?: unknown;
  error?: string | null;
}

export async function resolveComputerCommand(id: string, input: ResolveComputerCommandInput): Promise<ComputerCommandRecord> {
  const db = getDb();
  const existing = db.select().from(computerCommands).where(eq(computerCommands.id, id)).get();
  if (!existing) throw new NotFoundError("ComputerCommand", id);

  const completedAt = new Date().toISOString();
  db
    .update(computerCommands)
    .set({ state: input.state, result: input.result ?? null, error: input.error ?? null, completedAt })
    .where(eq(computerCommands.id, id))
    .run();

  return { ...(existing as ComputerCommandRecord), state: input.state, result: input.result ?? null, error: input.error ?? null, completedAt };
}

export async function getComputerCommand(id: string): Promise<ComputerCommandRecord | undefined> {
  const db = getDb();
  return db.select().from(computerCommands).where(eq(computerCommands.id, id)).get() as ComputerCommandRecord | undefined;
}

export async function listRecentComputerCommands(userId: string, limit = 50): Promise<ComputerCommandRecord[]> {
  const db = getDb();
  const rows = db
    .select({ command: computerCommands })
    .from(computerCommands)
    .innerJoin(devices, eq(computerCommands.deviceId, devices.id))
    .where(eq(devices.userId, userId))
    .orderBy(desc(computerCommands.createdAt))
    .limit(limit)
    .all();
  return rows.map((r) => r.command) as ComputerCommandRecord[];
}
