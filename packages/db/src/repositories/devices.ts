import { eq } from "drizzle-orm";
import { generateId, type Device, type DeviceStatus } from "@jarvis/shared";
import { getDb } from "../client.js";
import { devices } from "../schema.js";

export async function registerDevice(userId: string, name: string, platform: string): Promise<Device> {
  const db = getDb();
  const record: Device = {
    id: generateId("device"),
    userId,
    name,
    platform,
    status: "PENDING_PAIRING",
    lastSeenAt: null,
    createdAt: new Date().toISOString(),
  };
  db.insert(devices).values(record).run();
  return record;
}

export async function listDevices(userId: string): Promise<Device[]> {
  const db = getDb();
  return db.select().from(devices).where(eq(devices.userId, userId)).all() as Device[];
}

export async function updateDeviceStatus(id: string, status: DeviceStatus): Promise<void> {
  const db = getDb();
  db
    .update(devices)
    .set({ status, lastSeenAt: status === "ONLINE" ? new Date().toISOString() : undefined })
    .where(eq(devices.id, id))
    .run();
}
