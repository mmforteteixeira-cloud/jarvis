import { z } from "zod";
import { AGENT_TYPES, PROJECT_STATES } from "@jarvis/shared";

/**
 * Request-body schemas shared between API routes and tests. Kept separate
 * from the route files so "API validation" can be unit-tested without
 * spinning up a Next.js server.
 */

export const ChatRequestSchema = z.object({
  message: z.string().min(1, "message is required").max(8000),
  conversationId: z.string().optional(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  goal: z.string().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  goal: z.string().max(4000).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  status: z.enum(PROJECT_STATES).optional(),
});

export const CreateTaskSchema = z.object({
  description: z.string().min(1).max(2000),
  projectId: z.string().nullable().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  agentType: z.enum(AGENT_TYPES).nullable().optional(),
  input: z.unknown().optional(),
});
