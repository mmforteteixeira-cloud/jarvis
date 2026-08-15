import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { getDeviceByExternalId, listDevices, reapStaleDevices, updateDeviceStatus, upsertDevice } from "./devices.js";

describe("device registration", () => {
  it("creates a new device on first registration", async () => {
    const device = await upsertDevice({
      userId: "user_1",
      externalId: "ext-1",
      name: "Test Mac",
      platform: "darwin",
      architecture: "arm64",
      agentVersion: "0.1.0",
    });
    expect(device.status).toBe("PENDING_PAIRING");
    expect(device.externalId).toBe("ext-1");
  });

  it("re-registering with the same externalId updates the same row, not a new one", async () => {
    await upsertDevice({ userId: "user_2", externalId: "ext-2", name: "First Name", platform: "darwin", architecture: "arm64", agentVersion: "0.1.0" });
    const second = await upsertDevice({ userId: "user_2", externalId: "ext-2", name: "Renamed", platform: "darwin", architecture: "arm64", agentVersion: "0.2.0" });

    const all = await listDevices("user_2");
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe("Renamed");
    expect(all[0].agentVersion).toBe("0.2.0");
    expect(second.status).toBe("CONNECTING");
  });

  it("finds a device by externalId", async () => {
    await upsertDevice({ userId: "user_3", externalId: "ext-3", name: "Findable", platform: "linux", architecture: "x64", agentVersion: "0.1.0" });
    const found = await getDeviceByExternalId("user_3", "ext-3");
    expect(found?.name).toBe("Findable");
  });

  it("scopes devices per user", async () => {
    await upsertDevice({ userId: "user_a", externalId: "ext-a", name: "A", platform: "darwin", architecture: "arm64", agentVersion: "0.1.0" });
    await upsertDevice({ userId: "user_b", externalId: "ext-b", name: "B", platform: "darwin", architecture: "arm64", agentVersion: "0.1.0" });
    expect(await getDeviceByExternalId("user_a", "ext-b")).toBeUndefined();
  });
});

describe("heartbeat / staleness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks a device ONLINE and records lastSeenAt", async () => {
    const device = await upsertDevice({ userId: "user_hb", externalId: "ext-hb", name: "HB", platform: "darwin", architecture: "arm64", agentVersion: "0.1.0" });
    await updateDeviceStatus(device.id, "ONLINE");
    const [fetched] = await listDevices("user_hb");
    expect(fetched.status).toBe("ONLINE");
    expect(fetched.lastSeenAt).not.toBeNull();
  });

  it("reaps a device with a stale heartbeat to OFFLINE", async () => {
    const device = await upsertDevice({ userId: "user_stale", externalId: "ext-stale", name: "Stale", platform: "darwin", architecture: "arm64", agentVersion: "0.1.0" });
    await updateDeviceStatus(device.id, "ONLINE");

    vi.advanceTimersByTime(60_000); // past the 45s offline threshold

    await reapStaleDevices("user_stale");
    const [fetched] = await listDevices("user_stale");
    expect(fetched.status).toBe("OFFLINE");
  });

  it("does not reap a device with a fresh heartbeat", async () => {
    const device = await upsertDevice({ userId: "user_fresh", externalId: "ext-fresh", name: "Fresh", platform: "darwin", architecture: "arm64", agentVersion: "0.1.0" });
    await updateDeviceStatus(device.id, "ONLINE");

    vi.advanceTimersByTime(5_000); // well within the threshold

    await reapStaleDevices("user_fresh");
    const [fetched] = await listDevices("user_fresh");
    expect(fetched.status).toBe("ONLINE");
  });
});
