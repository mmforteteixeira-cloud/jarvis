import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { runAdHocAgentTask } from "@/lib/server/adhoc";
import { listDevices, registerDevice } from "@jarvis/db";

export const GET = withErrorHandling(async () => {
  const { user } = await getJarvis();
  const devices = await listDevices(user.id);
  return ok({ devices });
});

const PairSchema = z.object({ name: z.string().min(1).max(100), platform: z.string().min(1).max(50) });

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = PairSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid device pairing payload", parsed.error.flatten());

  const { user } = await getJarvis();
  const device = await registerDevice(user.id, parsed.data.name, parsed.data.platform);

  // Exercises the real (but NOT_CONNECTED) Computer Agent execution path so
  // callers see the honest current state rather than an empty response.
  const task = await runAdHocAgentTask({
    agentType: "COMPUTER",
    description: `Pair device ${parsed.data.name}`,
    input: { userId: user.id, command: { kind: "screenshot" } },
  });

  return ok({ device, task }, 201);
});
