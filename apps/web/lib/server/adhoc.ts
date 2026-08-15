import "server-only";
import type { AgentType, Task } from "@jarvis/shared";
import { getJarvis } from "./init";

/**
 * Creates and immediately executes a single-agent task — used by the
 * quick-action API routes (/api/browser, /api/email, /api/content,
 * /api/computer) where the UI wants a direct result rather than managing a
 * queued task by hand. It still goes through the exact same TaskEngine +
 * security policy as anything created by the Orchestrator.
 */
export async function runAdHocAgentTask(params: {
  agentType: AgentType;
  description: string;
  input: unknown;
  projectId?: string | null;
}): Promise<Task> {
  const { taskEngine } = await getJarvis();
  const task = await taskEngine.create({
    projectId: params.projectId ?? null,
    description: params.description,
    agentType: params.agentType,
    input: params.input,
    priority: "MEDIUM",
  });
  return taskEngine.execute(task.id);
}
