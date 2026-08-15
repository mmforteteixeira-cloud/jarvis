import { NotFoundError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listAgentRuns } from "@jarvis/db";

type RouteParams = { params: Promise<{ id: string }> };

export const GET = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const { taskEngine } = await getJarvis();
  const task = await taskEngine.get(id);
  if (!task) throw new NotFoundError("Task", id);
  const runs = await listAgentRuns(id);
  return ok({ task, runs });
});
