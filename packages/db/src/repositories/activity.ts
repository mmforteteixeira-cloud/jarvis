import { desc, eq } from "drizzle-orm";
import { generateId, type ActivityLogEntry } from "@jarvis/shared";
import { getDb } from "../client.js";
import { activityLogs } from "../schema.js";

export type LogActivityInput = Omit<ActivityLogEntry, "id" | "timestamp">;

export async function logActivity(input: LogActivityInput): Promise<ActivityLogEntry> {
  const db = getDb();
  const record: ActivityLogEntry = { id: generateId("act"), timestamp: new Date().toISOString(), ...input };
  db.insert(activityLogs).values(record).run();
  return record;
}

export async function listActivity(filter?: { taskId?: string; projectId?: string; limit?: number }): Promise<ActivityLogEntry[]> {
  const db = getDb();
  const query = filter?.taskId
    ? db.select().from(activityLogs).where(eq(activityLogs.taskId, filter.taskId))
    : filter?.projectId
      ? db.select().from(activityLogs).where(eq(activityLogs.projectId, filter.projectId))
      : db.select().from(activityLogs);
  return query.orderBy(desc(activityLogs.timestamp)).limit(filter?.limit ?? 200).all() as ActivityLogEntry[];
}
