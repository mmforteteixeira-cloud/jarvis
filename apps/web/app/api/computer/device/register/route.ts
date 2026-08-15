import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { upsertDevice, updateDeviceStatus } from "@jarvis/db";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { requireComputerAgentToken } from "@/lib/server/computer-auth";

const RegisterSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1).max(100),
  platform: z.enum(["darwin", "win32", "linux"]),
  architecture: z.string().min(1).max(50),
  agentVersion: z.string().min(1).max(50),
});

export const POST = withErrorHandling(async (request: Request) => {
  requireComputerAgentToken(request);

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid device registration payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const device = await upsertDevice({ userId: user.id, ...parsed.data });
  await updateDeviceStatus(device.id, "ONLINE");

  return ok({ deviceId: device.id, status: "ONLINE" }, 201);
});
