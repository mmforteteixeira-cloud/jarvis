import { getJarvis } from "@/lib/server/init";
import { ok, withErrorHandling } from "@/lib/server/api";
import { listAgentDescriptors } from "@jarvis/db";

export const GET = withErrorHandling(async () => {
  const { registry, user } = await getJarvis();
  await registry.syncDescriptors(user.id);
  const descriptors = await listAgentDescriptors();
  return ok({ agents: descriptors });
});
