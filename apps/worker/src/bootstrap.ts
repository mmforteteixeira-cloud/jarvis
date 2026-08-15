import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { getOrCreateDefaultUser } from "@jarvis/db";
import { getAgentRegistry } from "@jarvis/agents";
import { Orchestrator, TaskEngine } from "@jarvis/core";

const WORKSPACE_ROOT = resolve(process.cwd(), "..", "..", "workspace");

export async function bootstrap() {
  mkdirSync(WORKSPACE_ROOT, { recursive: true });

  const user = await getOrCreateDefaultUser(process.env.JARVIS_OWNER_EMAIL ?? "owner@local", "Owner");
  const registry = getAgentRegistry(WORKSPACE_ROOT);
  await registry.syncDescriptors(user.id);

  const taskEngine = new TaskEngine({ workspaceRoot: WORKSPACE_ROOT, userId: user.id });
  const orchestrator = new Orchestrator(taskEngine);

  return { user, registry, taskEngine, orchestrator, workspaceRoot: WORKSPACE_ROOT };
}
