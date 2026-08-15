import { describe, expect, it } from "vitest";
import {
  claimNextComputerCommand,
  createComputerCommand,
  expireStaleCommands,
  getComputerCommand,
  resolveComputerCommand,
} from "./computer-commands.js";

describe("computer command lifecycle", () => {
  it("creates a command in PENDING state", async () => {
    const cmd = await createComputerCommand({
      deviceId: "device_1",
      type: "SYSTEM_INFO",
      payload: {},
      riskLevel: "LOW_RISK",
    });
    expect(cmd.state).toBe("PENDING");
    expect(cmd.result).toBeNull();
    expect(cmd.startedAt).toBeNull();
  });

  it("claims the oldest pending command and moves it to RUNNING", async () => {
    const cmd = await createComputerCommand({
      deviceId: "device_2",
      type: "LIST_DIRECTORY",
      payload: { path: "." },
      riskLevel: "LOW_RISK",
    });

    const claimed = await claimNextComputerCommand("device_2");
    expect(claimed?.id).toBe(cmd.id);
    expect(claimed?.state).toBe("RUNNING");
    expect(claimed?.startedAt).not.toBeNull();
  });

  it("returns undefined when there is nothing pending for a device", async () => {
    const claimed = await claimNextComputerCommand("device_with_no_commands");
    expect(claimed).toBeUndefined();
  });

  it("does not claim the same command twice", async () => {
    await createComputerCommand({ deviceId: "device_3", type: "SCREENSHOT", payload: {}, riskLevel: "LOW_RISK" });
    const first = await claimNextComputerCommand("device_3");
    const second = await claimNextComputerCommand("device_3");
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("resolves a command to COMPLETED with a result", async () => {
    const cmd = await createComputerCommand({ deviceId: "device_4", type: "SYSTEM_INFO", payload: {}, riskLevel: "LOW_RISK" });
    const resolved = await resolveComputerCommand(cmd.id, { state: "COMPLETED", result: { os: "linux" } });
    expect(resolved.state).toBe("COMPLETED");
    expect(resolved.result).toEqual({ os: "linux" });
    expect(resolved.completedAt).not.toBeNull();

    const fetched = await getComputerCommand(cmd.id);
    expect(fetched?.state).toBe("COMPLETED");
  });

  it("resolves a command to REJECTED with an error (daemon-side policy refusal)", async () => {
    const cmd = await createComputerCommand({ deviceId: "device_5", type: "RUN_COMMAND", payload: { command: "rm" }, riskLevel: "HIGH_RISK" });
    const resolved = await resolveComputerCommand(cmd.id, { state: "REJECTED", error: "blocked command pattern" });
    expect(resolved.state).toBe("REJECTED");
    expect(resolved.error).toMatch(/blocked/);
  });

  it("expires a stale PENDING command past its TTL", async () => {
    const cmd = await createComputerCommand({
      deviceId: "device_6",
      type: "SYSTEM_INFO",
      payload: {},
      riskLevel: "LOW_RISK",
      ttlMs: -1, // already expired
    });
    await expireStaleCommands("device_6");
    const fetched = await getComputerCommand(cmd.id);
    expect(fetched?.state).toBe("EXPIRED");
  });

  it("does not claim an expired command", async () => {
    await createComputerCommand({
      deviceId: "device_7",
      type: "SYSTEM_INFO",
      payload: {},
      riskLevel: "LOW_RISK",
      ttlMs: -1,
    });
    const claimed = await claimNextComputerCommand("device_7");
    expect(claimed).toBeUndefined();
  });
});
