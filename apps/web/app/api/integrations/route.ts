import { getIntegrationDescriptors } from "@jarvis/core";
import { ok, withErrorHandling } from "@/lib/server/api";

export const GET = withErrorHandling(async () => {
  const integrations = getIntegrationDescriptors();
  return ok({ integrations });
});
