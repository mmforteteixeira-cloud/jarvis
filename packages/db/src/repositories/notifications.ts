import { and, desc, eq } from "drizzle-orm";
import { generateId, type Notification, type NotificationSeverity } from "@jarvis/shared";
import { getDb } from "../client.js";
import { notifications } from "../schema.js";

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  taskId?: string | null;
  projectId?: string | null;
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const db = getDb();
  const record: Notification = {
    id: generateId("notif"),
    userId: input.userId,
    title: input.title,
    message: input.message,
    severity: input.severity ?? "info",
    read: false,
    taskId: input.taskId ?? null,
    projectId: input.projectId ?? null,
    createdAt: new Date().toISOString(),
  };
  db.insert(notifications).values(record).run();
  return record;
}

export async function listNotifications(userId: string, unreadOnly = false): Promise<Notification[]> {
  const db = getDb();
  const conditions = [eq(notifications.userId, userId)];
  if (unreadOnly) conditions.push(eq(notifications.read, false));
  return db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .all() as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const db = getDb();
  db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).run();
}
