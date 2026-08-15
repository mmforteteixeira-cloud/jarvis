import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { ok, withErrorHandling } from "@/lib/server/api";
import { runAdHocAgentTask } from "@/lib/server/adhoc";

const EmailRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("getAuthUrl") }),
  z.object({ op: z.literal("listUnread"), maxResults: z.number().optional() }),
  z.object({ op: z.literal("draft"), to: z.string().email(), subject: z.string(), body: z.string() }),
  z.object({ op: z.literal("send"), to: z.string().email(), subject: z.string(), body: z.string() }),
]);

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = EmailRequestSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid email request", parsed.error.flatten());

  const task = await runAdHocAgentTask({
    agentType: "EMAIL",
    description: `Email: ${parsed.data.op}`,
    input: parsed.data,
  });
  return ok({ task });
});
