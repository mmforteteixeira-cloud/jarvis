import { eq } from "drizzle-orm";
import type { IntegrationDescriptor } from "@jarvis/shared";
import { getDb } from "../client.js";
import { integrations } from "../schema.js";

/** Integrations are recomputed from env on every read (see
 * packages/core/src/integrations.ts); this table just persists the last
 * snapshot for history/debugging. */
export async function upsertIntegrationSnapshot(descriptor: IntegrationDescriptor): Promise<void> {
  const db = getDb();
  const updatedAt = new Date().toISOString();
  const existing = db.select().from(integrations).where(eq(integrations.id, descriptor.id)).get();
  if (existing) {
    db.update(integrations).set({ ...descriptor, updatedAt }).where(eq(integrations.id, descriptor.id)).run();
  } else {
    db.insert(integrations).values({ ...descriptor, updatedAt }).run();
  }
}

export async function listIntegrationSnapshots(): Promise<IntegrationDescriptor[]> {
  const db = getDb();
  return db.select().from(integrations).all() as unknown as IntegrationDescriptor[];
}
