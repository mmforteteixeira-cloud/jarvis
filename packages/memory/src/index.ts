import * as repo from "@jarvis/db";
import type { Memory, MemoryType } from "@jarvis/shared";

/**
 * The Memory layer JARVIS Core talks to. It sits on top of @jarvis/db's raw
 * repository and adds the behaviour that makes memory useful for an
 * assistant: building relevant context for a prompt, and keeping SHORT_TERM
 * memory from growing unbounded.
 */

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
  return repo.saveMemory(input);
}

export interface SearchMemoryInput {
  userId: string;
  type?: MemoryType;
  projectId?: string;
  query?: string;
  limit?: number;
}

export async function searchMemory(input: SearchMemoryInput): Promise<Memory[]> {
  return repo.searchMemory(input);
}

export async function updateMemory(
  id: string,
  patch: Partial<Pick<Memory, "content" | "metadata" | "importance">>,
): Promise<Memory> {
  return repo.updateMemory(id, patch);
}

export async function deleteMemory(id: string): Promise<void> {
  return repo.deleteMemory(id);
}

const SHORT_TERM_CAP = 40;

/** Called after saving a SHORT_TERM memory to keep the working set bounded
 * — oldest/least-important entries are pruned rather than kept forever. */
export async function pruneShortTermMemory(userId: string): Promise<void> {
  const shortTerm = await repo.searchMemory({ userId, type: "SHORT_TERM", limit: 1000 });
  if (shortTerm.length <= SHORT_TERM_CAP) return;
  const sorted = [...shortTerm].sort((a, b) => a.importance - b.importance || a.createdAt.localeCompare(b.createdAt));
  const toRemove = sorted.slice(0, shortTerm.length - SHORT_TERM_CAP);
  await Promise.all(toRemove.map((m) => repo.deleteMemory(m.id)));
}

/**
 * Builds the memory context JARVIS Core injects into the LLM prompt: recent
 * short-term memory, user preferences, and (if a project is active)
 * project-scoped memory — capped to keep prompts small.
 */
export async function buildMemoryContext(userId: string, projectId?: string): Promise<Memory[]> {
  const [shortTerm, preferences, project] = await Promise.all([
    repo.searchMemory({ userId, type: "SHORT_TERM", limit: 8 }),
    repo.searchMemory({ userId, type: "USER_PREFERENCE", limit: 8 }),
    projectId ? repo.searchMemory({ userId, projectId, type: "PROJECT", limit: 8 }) : Promise.resolve([]),
  ]);

  const seen = new Set<string>();
  const merged: Memory[] = [];
  for (const m of [...preferences, ...project, ...shortTerm]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    merged.push(m);
  }
  return merged;
}
