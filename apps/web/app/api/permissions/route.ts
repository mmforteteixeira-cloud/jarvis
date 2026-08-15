import { ok, withErrorHandling } from "@/lib/server/api";
import { listPermissions } from "@jarvis/db";
import { PERMISSION_STATES } from "@jarvis/shared";

export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const stateParam = url.searchParams.get("state") ?? undefined;
  const state = stateParam && (PERMISSION_STATES as readonly string[]).includes(stateParam) ? (stateParam as (typeof PERMISSION_STATES)[number]) : undefined;
  const permissions = await listPermissions({ state });
  return ok({ permissions });
});
