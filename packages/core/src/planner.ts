import { getAIProvider } from "@jarvis/ai";
import { createLogger, type AgentType } from "@jarvis/shared";

const logger = createLogger("core:planner");

export interface PlanStep {
  description: string;
  agentType: AgentType | null;
}

export interface Plan {
  steps: PlanStep[];
  source: "ai" | "heuristic";
}

const VALID_AGENT_TYPES: AgentType[] = ["DEVELOPER", "RESEARCH", "BROWSER", "FILE", "COMPUTER", "EMAIL", "CONTENT"];

const SOFTWARE_KEYWORDS = /\b(app|aplica[cç][aã]o|website|site|sistema|plataforma|software|programa)\b/i;

/**
 * Turns a goal into an ordered list of plan steps. Uses the configured AI
 * provider when it's REAL (Anthropic/OpenAI); falls back to a deterministic
 * heuristic template when running in DEMO mode, so planning still works
 * with zero cost and zero external calls — just less adaptively.
 *
 * Either way this only *plans* — it never executes anything. Turning steps
 * into runnable, agent-dispatched tasks is a separate, explicit action.
 */
export async function createPlan(goal: string): Promise<Plan> {
  const ai = getAIProvider();

  if (ai.mode === "REAL") {
    try {
      const result = await ai.complete({
        system:
          "You are the Planner inside JARVIS, a personal AI assistant. Break the user's goal into a concrete, " +
          "ordered list of 5-12 steps. Respond with ONLY a JSON array, no prose, no markdown fences. Each item: " +
          '{"description": string, "agentType": one of ["DEVELOPER","RESEARCH","BROWSER","FILE","COMPUTER","EMAIL","CONTENT",null]}. ' +
          "Use null when the step is a planning/coordination step with no single concrete tool action yet.",
        messages: [{ role: "user", content: goal }],
        maxTokens: 1200,
      });
      const steps = parsePlanSteps(result.text);
      if (steps.length > 0) {
        return { steps, source: "ai" };
      }
      logger.warn("AI plan response could not be parsed, falling back to heuristic", { goal });
    } catch (error) {
      logger.warn("AI planning failed, falling back to heuristic", { error: (error as Error).message });
    }
  }

  return { steps: heuristicPlan(goal), source: "heuristic" };
}

function parsePlanSteps(text: string): PlanStep[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const raw = JSON.parse(match[0]) as Array<{ description?: unknown; agentType?: unknown }>;
    return raw
      .filter((item) => typeof item.description === "string" && item.description.trim().length > 0)
      .map((item) => ({
        description: String(item.description),
        agentType: VALID_AGENT_TYPES.includes(item.agentType as AgentType) ? (item.agentType as AgentType) : null,
      }));
  } catch {
    return [];
  }
}

function heuristicPlan(goal: string): PlanStep[] {
  if (SOFTWARE_KEYWORDS.test(goal)) {
    return [
      { description: "Analisar requisitos e objetivos do projeto", agentType: null },
      { description: "Definir funcionalidades principais", agentType: null },
      { description: "Escolher arquitetura técnica", agentType: null },
      { description: "Criar estrutura inicial do projeto", agentType: "DEVELOPER" },
      { description: "Implementar frontend", agentType: "DEVELOPER" },
      { description: "Implementar backend", agentType: "DEVELOPER" },
      { description: "Criar/configurar a base de dados", agentType: "DEVELOPER" },
      { description: "Implementar autenticação", agentType: "DEVELOPER" },
      { description: "Escrever e correr testes", agentType: "DEVELOPER" },
      { description: "Corrigir erros encontrados", agentType: "DEVELOPER" },
      { description: "Preparar deployment", agentType: null },
    ];
  }

  return [
    { description: `Pesquisar informação relevante sobre: ${goal}`, agentType: "RESEARCH" },
    { description: "Analisar e organizar a informação recolhida", agentType: null },
    { description: "Definir o plano de execução", agentType: null },
    { description: "Executar as ações necessárias", agentType: null },
    { description: "Verificar o resultado", agentType: null },
    { description: "Reportar o resultado ao utilizador", agentType: null },
  ];
}
