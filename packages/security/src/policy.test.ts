import { describe, expect, it } from "vitest";
import { enforceAction, approveAction } from "./policy.js";
import { listPermissions } from "@jarvis/db";

describe("permissions / risk policy", () => {
  it("allows LOW_RISK actions immediately, with no approval request", async () => {
    const result = await enforceAction({ action: "file.read", reason: "read a file", taskId: "task_low" });
    expect(result.allowed).toBe(true);
    expect(result.riskLevel).toBe("LOW_RISK");
  });

  it("blocks MEDIUM_RISK actions and creates a pending permission request", async () => {
    const result = await enforceAction({ action: "email.send", reason: "send an email", taskId: "task_medium" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.riskLevel).toBe("MEDIUM_RISK");
      expect(result.permissionRequest.state).toBe("PENDING");
    }
  });

  it("classifies unknown actions as HIGH_RISK (fail closed)", async () => {
    const result = await enforceAction({ action: "totally.unknown.action", reason: "mystery", taskId: "task_unknown" });
    expect(result.allowed).toBe(false);
    if (!result.allowed) expect(result.riskLevel).toBe("HIGH_RISK");
  });

  it("does not duplicate a pending request for the same task+action", async () => {
    await enforceAction({ action: "content.publish", reason: "publish 1", taskId: "task_dup" });
    await enforceAction({ action: "content.publish", reason: "publish 2", taskId: "task_dup" });
    const pending = await listPermissions({ state: "PENDING" });
    const matches = pending.filter((p) => p.taskId === "task_dup");
    expect(matches).toHaveLength(1);
  });

  it("re-checking after approval allows the same task+action through", async () => {
    const first = await enforceAction({ action: "settings.modify", reason: "change config", taskId: "task_approve" });
    if (first.allowed) throw new Error("expected first attempt to require approval");

    await approveAction(first.permissionRequest.id, "test-user");

    const second = await enforceAction({ action: "settings.modify", reason: "change config", taskId: "task_approve" });
    expect(second.allowed).toBe(true);
  });
});
