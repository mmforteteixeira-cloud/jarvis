import { ok, withErrorHandling } from "@/lib/server/api";
import { markNotificationRead } from "@jarvis/db";

type RouteParams = { params: Promise<{ id: string }> };

export const POST = withErrorHandling(async (_request: Request, { params }: RouteParams) => {
  const { id } = await params;
  await markNotificationRead(id);
  return ok({ read: id });
});
