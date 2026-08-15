import { and, desc, eq, like, or } from "drizzle-orm";
import { generateId, NotFoundError, ValidationError, type Memory, type MemoryType } from "@jarvis/shared";
import { getDb } from "../client.js";
import { memories } from "../schema.js";

// Matched against content that looks like it CONTAINS a credential value —
// e.g. "api_key: sk-abc123..." or "Bearer eyJhbGc..." — not just text that
// mentions the word "password"/"token" in passing (which is common and
// harmless, e.g. "no AI_API_KEY configured").
const SECRET_PATTERNS = [
  /(api[_-]?key|password|secret|token)\s*[:=]\s*\S{6,}/i,
  /bearer\s+[a-z0-9._-]{10,}/i,
  /\bsk-[a-zA-Z0-9]{16,}\b/,
  /\bgh[pousr]_[a-zA-Z0-9]{20,}\b/,
];

/** Memory must never become a place secrets leak into. Reject content that
 * looks like a credential rather than silently storing it. */
export function assertSafeMemoryContent(content: string) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      throw new ValidationError(
        "Refusing to store this memory: it looks like it may contain a password, API key, or token. " +
          "JARVIS never stores credentials as memory — use environment variables instead.",
      );
    }
  }
}

export interface SaveMemoryInput {
  userId: string;
  type: MemoryType;
  content: string;
  projectId?: string | null;
  taskId?: string | null;
  metadata?: Record<string, unknown>;
  importance?: number;
}

export async function saveMemory(input: SaveMemoryInput): Promise<Memory> {
  assertSafeMemoryContent(input.content);
  const db = getDb();
  const now = new Date().toISOString();
  const record: Memory = {
    id: generateId("mem"),
    userId: input.userId,
    type: input.type,
    projectId: input.projectId ?? null,
    taskId: input.taskId ?? null,
    content: input.content,
    metadata: input.metadata ?? {},
    importance: input.importance ?? 0.5,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(memories).values(record).run();
  return record;
}

export interface SearchMemoryFilter {
  userId: string;
  type?: MemoryType;
  projectId?: string;
  query?: string;
  limit?: number;
}

export async function searchMemory(filter: SearchMemoryFilter): Promise<Memory[]> {
  const db = getDb();
  const conditions = [eq(memories.userId, filter.userId)];
  if (filter.type) conditions.push(eq(memories.type, filter.type));
  if (filter.projectId) conditions.push(eq(memories.projectId, filter.projectId));
  if (filter.query) conditions.push(like(memories.content, `%${filter.query}%`));

  const rows = db
    .select()
    .from(memories)
    .where(and(...conditions))
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(filter.limit ?? 50)
    .all();
  return rows as Memory[];
}

export async function updateMemory(
  id: string,
  patch: Partial<Pick<Memory, "content" | "metadata" | "importance">>,
): Promise<Memory> {
  if (patch.content) assertSafeMemoryContent(patch.content);
  const db = getDb();
  const existing = db.select().from(memories).where(eq(memories.id, id)).get();
  if (!existing) throw new NotFoundError("Memory", id);
  const updatedAt = new Date().toISOString();
  db.update(memories).set({ ...patch, updatedAt }).where(eq(memories.id, id)).run();
  return { ...(existing as Memory), ...patch, updatedAt };
}

export async function deleteMemory(id: string): Promise<void> {
  const db = getDb();
  db.delete(memories).where(eq(memories.id, id)).run();
}

export async function getMemory(id: string): Promise<Memory | undefined> {
  const db = getDb();
  return db.select().from(memories).where(eq(memories.id, id)).get() as Memory | undefined;
}
