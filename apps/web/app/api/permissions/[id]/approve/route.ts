import { approveAction } from "@jarvis/security";
import { ok, withErrorHandling } from "@/lib/server/api";
import { getTask } from "@jarvis/db";
import { getJarvis } from "@/lib/server/init";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const permission = await approveAction(id, "user");

  // If this approval unblocked a WAITING_APPROVAL task, put it back in the
  // queue so the worker (or a manual "run") can resume it.
  if (permission.taskId) {
    const task = await getTask(permission.taskId);
    if (task?.state === "WAITING_APPROVAL") {
      const { taskEngine } = await getJarvis();
      await taskEngine.pause(task.id); // WAITING_APPROVAL -> PENDING, ready to re-run
    }
  }

  return ok({ permission });
});
