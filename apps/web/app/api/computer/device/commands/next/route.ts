import { NotFoundError, ValidationError } from "@jarvis/shared";
import { claimNextComputerCommand, getDeviceByExternalId } from "@jarvis/db";
import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { requireComputerAgentToken } from "@/lib/server/computer-auth";

export const GET = withErrorHandling(async (request: Request) => {
  requireComputerAgentToken(request);

  const url = new URL(request.url);
  const externalId = url.searchParams.get("externalId");
  if (!externalId) throw new ValidationError("externalId query parameter is required");

  const { user } = await getJarvis();
  const device = await getDeviceByExternalId(user.id, externalId);
  if (!device) throw new NotFoundError("Device", externalId);

  const command = await claimNextComputerCommand(device.id);
  return ok({ command: command ?? null });
});
