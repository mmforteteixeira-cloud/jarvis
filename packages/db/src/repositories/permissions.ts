import { desc, eq } from "drizzle-orm";
import { generateId, NotFoundError, ValidationError, type AgentType, type PermissionRequest, type PermissionState, type RiskLevel } from "@jarvis/shared";
import { getDb } from "../client.js";
import { permissions } from "../schema.js";

export interface RequestPermissionInput {
  taskId?: string | null;
  agentType?: AgentType | null;
  action: string;
  riskLevel: RiskLevel;
  reason: string;
}

export async function requestPermission(input: RequestPermissionInput): Promise<PermissionRequest> {
  const db = getDb();
  const record: PermissionRequest = {
    id: generateId("perm"),
    taskId: input.taskId ?? null,
    agentType: input.agentType ?? null,
    action: input.action,
    riskLevel: input.riskLevel,
    reason: input.reason,
    state: "PENDING",
    requestedAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };
  db.insert(permissions).values(record).run();
  return record;
}

export async function resolvePermission(
  id: string,
  state: Extract<PermissionState, "APPROVED" | "DENIED">,
  resolvedBy: string,
): Promise<PermissionRequest> {
  const db = getDb();
  const existing = db.select().from(permissions).where(eq(permissions.id, id)).get();
  if (!existing) throw new NotFoundError("PermissionRequest", id);
  if (existing.state !== "PENDING") {
    throw new ValidationError(`Permission request ${id} is already ${existing.state}`);
  }
  const resolvedAt = new Date().toISOString();
  db.update(permissions).set({ state, resolvedAt, resolvedBy }).where(eq(permissions.id, id)).run();
  return { ...(existing as PermissionRequest), state, resolvedAt, resolvedBy };
}

export async function listPermissions(filter?: { state?: PermissionState }): Promise<PermissionRequest[]> {
  const db = getDb();
  const rows = filter?.state
    ? db.select().from(permissions).where(eq(permissions.state, filter.state)).orderBy(desc(permissions.requestedAt)).all()
    : db.select().from(permissions).orderBy(desc(permissions.requestedAt)).all();
  return rows as PermissionRequest[];
}

export async function getPermission(id: string): Promise<PermissionRequest | undefined> {
  const db = getDb();
  return db.select().from(permissions).where(eq(permissions.id, id)).get() as PermissionRequest | undefined;
}
