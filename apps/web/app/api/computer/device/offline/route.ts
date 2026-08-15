import { z } from "zod";
import { NotFoundError, ValidationError } from "@jarvis/shared";
import { getDeviceByExternalId, updateDeviceStatus } from "@jarvis/db";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { requireComputerAgentToken } from "@/lib/server/computer-auth";

const OfflineSchema = z.object({ externalId: z.string().min(1) });

/** Best-effort courtesy call the daemon makes on graceful shutdown
 * (SIGINT/SIGTERM) so the dashboard flips to OFFLINE immediately instead
 * of waiting ~45s for the heartbeat staleness check to catch up. */
export const POST = withErrorHandling(async (request: Request) => {
  requireComputerAgentToken(request);

  const body = await request.json().catch(() => null);
  const parsed = OfflineSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const device = await getDeviceByExternalId(user.id, parsed.data.externalId);
  if (!device) throw new NotFoundError("Device", parsed.data.externalId);

  await updateDeviceStatus(device.id, "OFFLINE");
  return ok({ status: "OFFLINE" });
});
