import { ok, withErrorHandling } from "@/lib/server/api";
import { cancelReminder } from "@jarvis/db";

type RouteParams = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  await cancelReminder(id);
  return ok({ cancelled: id });
});
