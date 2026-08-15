import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const { taskEngine } = await getJarvis();
  const task = await taskEngine.execute(id);
  return ok({ task });
});
