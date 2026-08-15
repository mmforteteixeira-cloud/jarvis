import { listPermissions, requestPermission, resolvePermission, type RequestPermissionInput } from "@jarvis/db";
import type { AgentType, PermissionRequest, RiskLevel } from "@jarvis/shared";
import { classifyAction } from "./risk.js";

export interface EnforceActionInput {
  action: string;
  riskLevel?: RiskLevel;
  agentType?: AgentType | null;
  taskId?: string | null;
  reason: string;
}

export type EnforceActionResult =
  | { allowed: true; riskLevel: RiskLevel }
  | { allowed: false; riskLevel: RiskLevel; permissionRequest: PermissionRequest };

/**
 * The single choke point every agent/tool call must pass through before it
 * touches the outside world. LOW_RISK actions execute immediately.
 * MEDIUM_RISK and HIGH_RISK actions are blocked and recorded as a pending
 * PermissionRequest — the caller (Task Engine) must transition the task to
 * WAITING_APPROVAL and stop, never proceed speculatively.
 */
export async function enforceAction(input: EnforceActionInput): Promise<EnforceActionResult> {
  const riskLevel = input.riskLevel ?? classifyAction(input.action);

  if (riskLevel === "LOW_RISK") {
    return { allowed: true, riskLevel };
  }

  // A task resumed after approval re-runs its agent from the top — look for
  // an already-APPROVED request for this exact task+action before asking
  // again, so approval actually unblocks execution instead of looping.
  if (input.taskId) {
    const existing = await listPermissions({ state: "APPROVED" });
    const match = existing.find((p) => p.taskId === input.taskId && p.action === input.action);
    if (match) {
      return { allowed: true, riskLevel };
    }
  }

  if (input.taskId) {
    const pending = await listPermissions({ state: "PENDING" });
    const match = pending.find((p) => p.taskId === input.taskId && p.action === input.action);
    if (match) {
      return { allowed: false, riskLevel, permissionRequest: match };
    }
  }

  const permInput: RequestPermissionInput = {
    taskId: input.taskId ?? null,
    agentType: input.agentType ?? null,
    action: input.action,
    riskLevel,
    reason: input.reason,
  };
  const permissionRequest = await requestPermission(permInput);
  return { allowed: false, riskLevel, permissionRequest };
}

export async function approveAction(permissionRequestId: string, resolvedBy = "user"): Promise<PermissionRequest> {
  return resolvePermission(permissionRequestId, "APPROVED", resolvedBy);
}

export async function denyAction(permissionRequestId: string, resolvedBy = "user"): Promise<PermissionRequest> {
  return resolvePermission(permissionRequestId, "DENIED", resolvedBy);
}
