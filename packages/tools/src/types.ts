import type { RiskLevel } from "@jarvis/shared";

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  /** Key into @jarvis/security's ACTION_RISK_CATALOG. */
  action: string;
  riskLevel: RiskLevel;
  run: (input: TInput) => Promise<TOutput>;
}

export interface ToolExecutionOutcome<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  durationMs: number;
}

export async function timeExecution<T>(fn: () => Promise<T>): Promise<ToolExecutionOutcome<T>> {
  const start = Date.now();
  try {
    const output = await fn();
    return { success: true, output, durationMs: Date.now() - start };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    };
  }
}
