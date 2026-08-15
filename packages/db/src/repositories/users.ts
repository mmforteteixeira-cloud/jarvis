import { eq } from "drizzle-orm";
import { generateId } from "@jarvis/shared";
import { getDb } from "../client.js";
import { users } from "../schema.js";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Ensures a single local "owner" user exists and returns it. JARVIS is a
 * personal assistant — single-tenant by default — but every row is still
 * scoped by userId so multi-user support is a additive, not a rewrite. */
export async function getOrCreateDefaultUser(email: string, name = "Owner"): Promise<UserRecord> {
  const db = getDb();
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: UserRecord = { id: generateId("user"), email, name, createdAt: now, updatedAt: now };
  db.insert(users).values(record).run();
  return record;
}

export async function getUserById(id: string): Promise<UserRecord | undefined> {
  return getDb().select().from(users).where(eq(users.id, id)).get();
}
