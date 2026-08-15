import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (request: Request, { params }: RouteParams) => {
  enforceRateLimit(request, "task-execute", 30, 60_000);
  const { id } = await params;
  const { taskEngine } = await getJarvis();
  const task = await taskEngine.execute(id);
  return ok({ task });
});
