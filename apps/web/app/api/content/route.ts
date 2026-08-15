import { z } from "zod";
import { ValidationError } from "@jarvis/shared";
import { ok, withErrorHandling } from "@/lib/server/api";
import { runAdHocAgentTask } from "@/lib/server/adhoc";
import { listContent } from "@jarvis/db";

const ContentRequestSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("generateIdeas"), topic: z.string().min(1), count: z.number().optional() }),
  z.object({ op: z.literal("writeScript"), topic: z.string().min(1), projectId: z.string().nullable().optional() }),
  z.object({ op: z.literal("publishTikTok"), contentId: z.string() }),
]);

export const GET = withErrorHandling(async (request: Request) => {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const content = await listContent(projectId);
  return ok({ content });
});

export const POST = withErrorHandling(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = ContentRequestSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError("Invalid content request", parsed.error.flatten());

  const task = await runAdHocAgentTask({
    agentType: "CONTENT",
    description: `Content: ${parsed.data.op}`,
    input: parsed.data,
    projectId: "projectId" in parsed.data ? parsed.data.projectId ?? null : null,
  });
  return ok({ task });
});
