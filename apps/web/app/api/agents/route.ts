import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listAgentDescriptors } from "@jarvis/db";

export const GET = withErrorHandling(async () => {
  const { registry } = await getJarvis();
  await registry.syncDescriptors();
  const descriptors = await listAgentDescriptors();
  return ok({ agents: descriptors });
});
