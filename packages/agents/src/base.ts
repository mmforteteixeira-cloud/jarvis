import type { AgentDescriptor, AgentStatus, AgentType, PermissionRequest, RiskLevel } from "@jarvis/shared";

export interface AgentContext {
  taskId: string;
  projectId: string | null;
  input: unknown;
}

export type AgentResultMode = "REAL" | "NOT_CONFIGURED" | "NOT_CONNECTED";

export interface AgentExecutionResult {
  success: boolean;
  mode: AgentResultMode;
  output?: unknown;
  error?: string;
  /** Set when the agent had to stop because an action needs human approval. */
  requiresApproval?: PermissionRequest;
}

export interface Agent {
  readonly type: AgentType;
  descriptor(): AgentDescriptor;
  execute(ctx: AgentContext): Promise<AgentExecutionResult>;
}

export function baseDescriptor(params: {
  type: AgentType;
  name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  plannedCapabilities: string[];
}): AgentDescriptor {
  return { ...params };
}
