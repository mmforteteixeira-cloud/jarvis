import { and, eq } from "drizzle-orm";
import { generateId, type Device, type DeviceStatus } from "@jarvis/shared";
import { getDb } from "../client.js";
import { devices } from "../schema.js";

export interface RegisterDeviceInput {
  userId: string;
  name: string;
  platform: string;
  architecture?: string;
  agentVersion?: string;
  externalId?: string;
}

/** v0.1 manual-pairing signature — kept working unchanged. */
export async function registerDevice(userId: string, name: string, platform: string): Promise<Device> {
  return upsertDevice({ userId, name, platform });
}

/**
 * Idempotent device registration used by the Computer Agent daemon: if a
 * device with this (userId, externalId) already registered before, its row
 * is updated in place (name/platform/version can change across daemon
 * restarts or reinstalls) rather than creating a duplicate row every time
 * the daemon starts up.
 */
export async function upsertDevice(input: RegisterDeviceInput): Promise<Device> {
  const db = getDb();
  const now = new Date().toISOString();

  if (input.externalId) {
    const existing = db
      .select()
      .from(devices)
      .where(and(eq(devices.userId, input.userId), eq(devices.externalId, input.externalId)))
      .get();
    if (existing) {
      const updated: Device = {
        ...(existing as Device),
        name: input.name,
        platform: input.platform,
        architecture: input.architecture ?? existing.architecture,
        agentVersion: input.agentVersion ?? existing.agentVersion,
        status: "CONNECTING",
        lastSeenAt: now,
      };
      db
        .update(devices)
        .set({
          name: updated.name,
          platform: updated.platform,
          architecture: updated.architecture,
          agentVersion: updated.agentVersion,
          status: updated.status,
          lastSeenAt: updated.lastSeenAt,
        })
        .where(eq(devices.id, existing.id))
        .run();
      return updated;
    }
  }

  const record: Device = {
    id: generateId("device"),
    userId: input.userId,
    externalId: input.externalId ?? "",
    name: input.name,
    platform: input.platform,
    architecture: input.architecture ?? "",
    agentVersion: input.agentVersion ?? "",
    status: "PENDING_PAIRING",
    lastSeenAt: null,
    createdAt: now,
  };
  db.insert(devices).values(record).run();
  return record;
}

export async function listDevices(userId: string): Promise<Device[]> {
  const db = getDb();
  return db.select().from(devices).where(eq(devices.userId, userId)).all() as Device[];
}

export async function getDeviceByExternalId(userId: string, externalId: string): Promise<Device | undefined> {
  const db = getDb();
  return db
    .select()
    .from(devices)
    .where(and(eq(devices.userId, userId), eq(devices.externalId, externalId)))
    .get() as Device | undefined;
}

export async function getDevice(id: string): Promise<Device | undefined> {
  const db = getDb();
  return db.select().from(devices).where(eq(devices.id, id)).get() as Device | undefined;
}

export async function updateDeviceStatus(id: string, status: DeviceStatus): Promise<void> {
  const db = getDb();
  db
    .update(devices)
    .set({ status, lastSeenAt: status === "ONLINE" || status === "BUSY" ? new Date().toISOString() : undefined })
    .where(eq(devices.id, id))
    .run();
}

const OFFLINE_THRESHOLD_MS = 45_000; // 3x the daemon's default 15s heartbeat interval

/** A device that hasn't heartbeat-ed recently is stale — mark it OFFLINE
 * rather than trusting a status set minutes/hours ago. Called opportunistically
 * whenever device status is read, so the UI never shows a lying ONLINE. */
export async function reapStaleDevices(userId: string): Promise<void> {
  const db = getDb();
  const all = await listDevices(userId);
  const now = Date.now();
  for (const device of all) {
    if (device.status === "ONLINE" || device.status === "BUSY" || device.status === "CONNECTING") {
      const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
      if (now - lastSeen > OFFLINE_THRESHOLD_MS) {
        db.update(devices).set({ status: "OFFLINE" }).where(eq(devices.id, device.id)).run();
      }
    }
  }
}
