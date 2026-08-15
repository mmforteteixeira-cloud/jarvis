import { denyAction } from "@jarvis/security";
import { ok, withErrorHandling } from "@/lib/server/api";
import { getTask, updateTask } from "@jarvis/db";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  const permission = await denyAction(id, "user");

  if (permission.taskId) {
    const task = await getTask(permission.taskId);
    if (task?.state === "WAITING_APPROVAL") {
      await updateTask(task.id, { state: "FAILED", error: "Permission denied by user." });
    }
  }

  return ok({ permission });
});
