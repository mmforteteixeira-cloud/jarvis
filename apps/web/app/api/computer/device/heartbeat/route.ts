import { z } from "zod";
import { NotFoundError, ValidationError } from "@jarvis/shared";
import { getDeviceByExternalId, updateDeviceStatus } from "@jarvis/db";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { requireComputerAgentToken } from "@/lib/server/computer-auth";

const HeartbeatSchema = z.object({
  externalId: z.string().min(1),
  status: z.enum(["ONLINE", "BUSY"]),
  agentVersion: z.string().min(1).max(50),
});

export const POST = withErrorHandling(async (request: Request) => {
  requireComputerAgentToken(request);

  const body = await request.json().catch(() => null);
  const parsed = HeartbeatSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid heartbeat payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const device = await getDeviceByExternalId(user.id, parsed.data.externalId);
  if (!device) throw new NotFoundError("Device", parsed.data.externalId);

  await updateDeviceStatus(device.id, parsed.data.status);
  return ok({ received: true, timestamp: new Date().toISOString() });
});
