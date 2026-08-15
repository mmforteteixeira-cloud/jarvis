import { and, desc, eq } from "drizzle-orm";
import { generateId, NotFoundError, type Project, type ProjectState, type TaskPriority } from "@jarvis/shared";
import { getDb } from "../client.js";
import { projects } from "../schema.js";

export interface CreateProjectInput {
  userId: string;
  name: string;
  description?: string;
  goal?: string;
  priority?: TaskPriority;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const db = getDb();
  const now = new Date().toISOString();
  const record: Project = {
    id: generateId("proj"),
    userId: input.userId,
    name: input.name,
    description: input.description ?? "",
    goal: input.goal ?? input.description ?? "",
    status: "PLANNING",
    priority: input.priority ?? "MEDIUM",
    createdAt: now,
    updatedAt: now,
  };
  db.insert(projects).values(record).run();
  return record;
}

export async function listProjects(userId?: string): Promise<Project[]> {
  const db = getDb();
  const rows = userId
    ? db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt)).all()
    : db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
  return rows as Project[];
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.id, id)).get() as Project | undefined;
}

export async function updateProjectStatus(id: string, status: ProjectState): Promise<Project> {
  const db = getDb();
  const existing = await getProject(id);
  if (!existing) throw new NotFoundError("Project", id);
  const updatedAt = new Date().toISOString();
  db.update(projects).set({ status, updatedAt }).where(eq(projects.id, id)).run();
  return { ...existing, status, updatedAt };
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, "name" | "description" | "goal" | "priority" | "status">>,
): Promise<Project> {
  const db = getDb();
  const existing = await getProject(id);
  if (!existing) throw new NotFoundError("Project", id);
  const updatedAt = new Date().toISOString();
  db.update(projects).set({ ...patch, updatedAt }).where(eq(projects.id, id)).run();
  return { ...existing, ...patch, updatedAt };
}

export async function deleteProject(id: string): Promise<void> {
  const db = getDb();
  db.delete(projects).where(eq(projects.id, id)).run();
}
