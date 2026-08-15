import { desc, eq } from "drizzle-orm";
import { generateId, type AgentDescriptor, type AgentRun, type AgentStatus, type AgentType, type ToolCall } from "@jarvis/shared";
import { getDb } from "../client.js";
import { agentRuns, agents } from "../schema.js";

export async function upsertAgentDescriptor(descriptor: AgentDescriptor): Promise<void> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const existing = db.select().from(agents).where(eq(agents.type, descriptor.type)).get();
  if (existing) {
    db
      .update(agents)
      .set({
        name: descriptor.name,
        description: descriptor.description,
        status: descriptor.status,
        capabilities: descriptor.capabilities,
        plannedCapabilities: descriptor.plannedCapabilities,
        updatedAt,
      })
      .where(eq(agents.type, descriptor.type))
      .run();
  } else {
    db.insert(agents).values({ ...descriptor, updatedAt }).run();
  }
}

export async function setAgentStatus(type: AgentType, status: AgentStatus): Promise<void> {
  const db = getDb();
  db.update(agents).set({ status, updatedAt: new Date().toISOString() }).where(eq(agents.type, type)).run();
}

export async function listAgentDescriptors(): Promise<AgentDescriptor[]> {
  const db = getDb();
  return db.select().from(agents).all() as unknown as AgentDescriptor[];
}

export async function startAgentRun(taskId: string, agentType: AgentType, input: unknown): Promise<AgentRun> {
  const db = getDb();
  const record: AgentRun = {
    id: generateId("run"),
    taskId,
    agentType,
    status: "RUNNING",
    input,
    output: null,
    toolCalls: [],
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
  };
  db.insert(agentRuns).values(record).run();
  return record;
}

export async function finishAgentRun(
  id: string,
  patch: { status: "COMPLETED" | "FAILED"; output?: unknown; error?: string | null; toolCalls?: ToolCall[] },
): Promise<void> {
  const db = getDb();
  db
    .update(agentRuns)
    .set({
      status: patch.status,
      output: patch.output ?? null,
      error: patch.error ?? null,
      toolCalls: patch.toolCalls ?? [],
      finishedAt: new Date().toISOString(),
    })
    .where(eq(agentRuns.id, id))
    .run();
}

export async function listAgentRuns(taskId?: string): Promise<AgentRun[]> {
  const db = getDb();
  const rows = taskId
    ? db.select().from(agentRuns).where(eq(agentRuns.taskId, taskId)).orderBy(desc(agentRuns.startedAt)).all()
    : db.select().from(agentRuns).orderBy(desc(agentRuns.startedAt)).limit(100).all();
  return rows as AgentRun[];
}
