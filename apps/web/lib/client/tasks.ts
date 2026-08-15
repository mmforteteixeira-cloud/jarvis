"use client";

import { api } from "./api";

export async function createAndRunTask(agentType: string, description: string, input: unknown) {
  const { task } = await api.post<{ task: { id: string } }>("/api/tasks", { description, agentType, input });
  const { task: executed } = await api.post<{ task: unknown }>(`/api/tasks/${task.id}/execute`);
  return executed;
}
