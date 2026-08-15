import { desc, eq } from "drizzle-orm";
import { generateId, NotFoundError, type ContentItem, type ContentState } from "@jarvis/shared";
import { getDb } from "../client.js";
import { content } from "../schema.js";

export interface CreateContentInput {
  projectId?: string | null;
  title: string;
  platform?: "tiktok" | "generic";
  script?: string;
  hashtags?: string[];
}

export async function createContent(input: CreateContentInput): Promise<ContentItem> {
  const db = getDb();
  const now = new Date().toISOString();
  const record: ContentItem = {
    id: generateId("content"),
    projectId: input.projectId ?? null,
    title: input.title,
    platform: input.platform ?? "generic",
    script: input.script ?? "",
    hashtags: input.hashtags ?? [],
    state: "DRAFT",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(content).values(record).run();
  return record;
}

export async function listContent(projectId?: string): Promise<ContentItem[]> {
  const db = getDb();
  const rows = projectId
    ? db.select().from(content).where(eq(content.projectId, projectId)).orderBy(desc(content.updatedAt)).all()
    : db.select().from(content).orderBy(desc(content.updatedAt)).all();
  return rows as ContentItem[];
}

export async function updateContentState(id: string, state: ContentState): Promise<ContentItem> {
  const db = getDb();
  const existing = db.select().from(content).where(eq(content.id, id)).get();
  if (!existing) throw new NotFoundError("Content", id);
  const updatedAt = new Date().toISOString();
  db.update(content).set({ state, updatedAt }).where(eq(content.id, id)).run();
  return { ...(existing as ContentItem), state, updatedAt };
}
