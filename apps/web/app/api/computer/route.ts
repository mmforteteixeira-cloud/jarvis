import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { runAdHocAgentTask } from "@/lib/server/adhoc";
import { listDevices, registerDevice, reapStaleDevices, listRecentComputerCommands } from "@jarvis/db";

export const GET = withErrorHandling(async () => {
  const { user } = await getJarvis();
  await reapStaleDevices(user.id);
  const [devices, commands] = await Promise.all([listDevices(user.id), listRecentComputerCommands(user.id, 30)]);
  return ok({ devices, commands });
});

const PairSchema = z.object({ name: z.string().min(1).max(100), platform: z.string().min(1).max(50) });

/**
 * Manual/legacy pairing: pre-creates a device row from the dashboard
 * before the real daemon (apps/computer-agent) has ever run. The daemon's
 * own self-registration (POST /api/computer/device/register) is the real
 * pairing path and supersedes this row once it connects with the same
 * externalId — this exists mainly to exercise the honest NOT_CONNECTED
 * path from the UI without needing the daemon running yet.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = PairSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid device pairing payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const device = await registerDevice(user.id, parsed.data.name, parsed.data.platform);

  const task = await runAdHocAgentTask({
    agentType: "COMPUTER",
    description: `Pair device ${parsed.data.name}`,
    input: { type: "SYSTEM_INFO", payload: {} },
  });

  return ok({ device, task }, 201);
});
