import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listNotifications } from "@jarvis/db";

export const GET = withErrorHandling(async (request: Request) => {
  const { user } = await getJarvis();
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const notifications = await listNotifications(user.id, unreadOnly);
  return ok({ notifications });
});
