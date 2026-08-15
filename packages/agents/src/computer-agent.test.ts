import { describe, expect, it } from "vitest";
import { getOrCreateDefaultUser, upsertDevice, updateDeviceStatus, listPermissions } from "@jarvis/db";
import { ComputerAgent } from "./computer-agent.js";
import type { AgentContext } from "./base.js";

async function makeContext(userId: string, input: unknown): Promise<AgentContext> {
  return { taskId: `task_${Math.random()}`, projectId: null, userId, input };
}

async function makeOnlineUser(suffix: string) {
  const user = await getOrCreateDefaultUser(`computer-agent-test-${suffix}@local`, "Test");
  const device = await upsertDevice({
    userId: user.id,
    externalId: `ext-${suffix}`,
    name: "Test Device",
    platform: "linux",
    architecture: "x64",
    agentVersion: "0.1.0",
  });
  await updateDeviceStatus(device.id, "ONLINE");
  return user;
}

describe("ComputerAgent — offline handling", () => {
  it("reports NOT_CONNECTED when the user has no online device", async () => {
    const user = await getOrCreateDefaultUser("computer-agent-test-offline@local", "Test");
    const agent = new ComputerAgent();
    const result = await agent.execute(await makeContext(user.id, { type: "SYSTEM_INFO", payload: {} }));

    expect(result.success).toBe(false);
    expect(result.mode).toBe("NOT_CONNECTED");
    expect(result.error).toMatch(/offline/i);
  });
});

describe("ComputerAgent — outright policy rejections (never fake success)", () => {
  it("rejects OPEN_APPLICATION for a non-allow-listed app without creating a permission request", async () => {
    const user = await makeOnlineUser("app-reject");
    const agent = new ComputerAgent();
    const result = await agent.execute(
      await makeContext(user.id, { type: "OPEN_APPLICATION", payload: { application: "TotallyUnknownApp" } }),
    );

    expect(result.success).toBe(false);
    expect(result.mode).toBe("REAL");
    expect(result.requiresApproval).toBeUndefined();
    expect(result.error).toMatch(/allowlist/i);
  });

  it("rejects OPEN_URL for an unsafe scheme", async () => {
    const user = await makeOnlineUser("url-reject");
    const agent = new ComputerAgent();
    const result = await agent.execute(
      await makeContext(user.id, { type: "OPEN_URL", payload: { url: "javascript:alert(1)" } }),
    );

    expect(result.success).toBe(false);
    expect(result.requiresApproval).toBeUndefined();
    expect(result.error).toMatch(/not a safe url/i);
  });

  it("rejects READ_FILE for a sensitive path", async () => {
    const user = await makeOnlineUser("read-reject");
    const agent = new ComputerAgent();
    const result = await agent.execute(await makeContext(user.id, { type: "READ_FILE", payload: { path: ".env" } }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/credential/i);
  });

  it("rejects RUN_COMMAND for a blocked shell pattern", async () => {
    const user = await makeOnlineUser("run-reject");
    const agent = new ComputerAgent();
    const result = await agent.execute(
      await makeContext(user.id, { type: "RUN_COMMAND", payload: { command: "rm", args: ["-rf", "/"] } }),
    );

    expect(result.success).toBe(false);
    expect(result.requiresApproval).toBeUndefined();
    expect(result.error).toMatch(/blocked/i);
  });
});

describe("ComputerAgent — approval flow", () => {
  it("requires approval for an unrecognized RUN_COMMAND (fails closed to HIGH)", async () => {
    const user = await makeOnlineUser("run-high");
    const agent = new ComputerAgent();
    const result = await agent.execute(
      await makeContext(user.id, { type: "RUN_COMMAND", payload: { command: "some-mystery-binary" } }),
    );

    expect(result.success).toBe(false);
    expect(result.requiresApproval).toBeDefined();
    expect(result.requiresApproval?.riskLevel).toBe("HIGH_RISK");

    const pending = await listPermissions({ state: "PENDING" });
    expect(pending.some((p) => p.id === result.requiresApproval?.id)).toBe(true);
  });

  it("requires approval for a MEDIUM-risk RUN_COMMAND", async () => {
    const user = await makeOnlineUser("run-medium");
    const agent = new ComputerAgent();
    const result = await agent.execute(
      await makeContext(user.id, { type: "RUN_COMMAND", payload: { command: "npm", args: ["install"] } }),
    );

    expect(result.requiresApproval?.riskLevel).toBe("MEDIUM_RISK");
  });
});

describe("ComputerAgent — honest timeout", () => {
  it("reports an honest timeout rather than a fabricated result when the daemon never responds", async () => {
    const user = await makeOnlineUser("timeout");
    const agent = new ComputerAgent({ maxWaitMs: 500 });
    const result = await agent.execute(await makeContext(user.id, { type: "SCREENSHOT", payload: {} }));

    expect(result.success).toBe(false);
    expect(result.mode).toBe("REAL");
    expect(result.error).toMatch(/did not respond/i);
  }, 3000);
});
