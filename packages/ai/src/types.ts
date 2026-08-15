export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AICompletionRequest {
  messages: AIMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AICompletionResult {
  text: string;
  providerName: string;
  model: string;
  mode: "REAL" | "DEMO";
}

export interface AIProvider {
  readonly name: string;
  readonly mode: "REAL" | "DEMO";
  readonly model: string;
  complete(request: AICompletionRequest): Promise<AICompletionResult>;
}
