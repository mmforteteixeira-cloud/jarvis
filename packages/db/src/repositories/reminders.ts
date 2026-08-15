import { and, asc, eq, lte } from "drizzle-orm";
import { generateId, type Reminder } from "@jarvis/shared";
import { getDb } from "../client.js";
import { reminders } from "../schema.js";

export interface CreateReminderInput {
  userId: string;
  message: string;
  dueAt: string;
}

export async function createReminder(input: CreateReminderInput): Promise<Reminder> {
  const db = getDb();
  const record: Reminder = {
    id: generateId("rem"),
    userId: input.userId,
    message: input.message,
    dueAt: input.dueAt,
    status: "PENDING",
    createdAt: new Date().toISOString(),
    firedAt: null,
  };
  db.insert(reminders).values(record).run();
  return record;
}

export async function listReminders(userId: string): Promise<Reminder[]> {
  const db = getDb();
  return db
    .select()
    .from(reminders)
    .where(eq(reminders.userId, userId))
    .orderBy(asc(reminders.dueAt))
    .all() as Reminder[];
}

/** Reminders that are PENDING and due — what the worker polls for. */
export async function listDueReminders(now = new Date().toISOString()): Promise<Reminder[]> {
  const db = getDb();
  return db
    .select()
    .from(reminders)
    .where(and(eq(reminders.status, "PENDING"), lte(reminders.dueAt, now)))
    .all() as Reminder[];
}

export async function markReminderFired(id: string): Promise<void> {
  const db = getDb();
  db.update(reminders).set({ status: "FIRED", firedAt: new Date().toISOString() }).where(eq(reminders.id, id)).run();
}

export async function cancelReminder(id: string): Promise<void> {
  const db = getDb();
  db.update(reminders).set({ status: "CANCELLED" }).where(eq(reminders.id, id)).run();
}
