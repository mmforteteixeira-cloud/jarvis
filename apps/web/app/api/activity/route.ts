import { ok, withErrorHandling } from "@/lib/server/api";
import { listActivity } from "@jarvis/db";

export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const activity = await listActivity({ taskId, projectId, limit });
  return ok({ activity });
});
