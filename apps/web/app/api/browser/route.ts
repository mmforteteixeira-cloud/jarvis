import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { ok, withErrorHandling } from "@/lib/server/api";
import { runAdHocAgentTask } from "@/lib/server/adhoc";

const BrowserRequestSchema = z.object({
  op: z.enum(["navigate", "screenshot"]),
  url: z.string().url(),
  projectId: z.string().nullable().optional(),
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = BrowserRequestSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid browser request", parsed.error.flatten());

  const { op, url, projectId } = parsed.data;
  const task = await runAdHocAgentTask({
    agentType: "BROWSER",
    description: `${op === "navigate" ? "Open" : "Screenshot"} ${url}`,
    input: { op, url },
    projectId,
  });
  return ok({ task });
});
