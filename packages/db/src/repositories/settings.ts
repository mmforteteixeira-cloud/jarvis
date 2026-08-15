import { eq } from "drizzle-orm";
import { getDb } from "../client.js";
import { settings } from "../schema.js";

export async function getSetting<T = unknown>(key: string): Promise<T | undefined> {
  const db = getDb();
  const row = db.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const existing = db.select().from(settings).where(eq(settings.key, key)).get();
  if (existing) {
    db.update(settings).set({ value, updatedAt }).where(eq(settings.key, key)).run();
  } else {
    db.insert(settings).values({ key, value, updatedAt }).run();
  }
}
