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
  /**
   * Same contract as complete(), but invokes onToken with each incremental
   * text chunk as it arrives so callers can stream a response to the UI.
   * Still resolves with the full AICompletionResult once done — callers
   * that don't care about incremental output can ignore onToken and just
   * await the return value.
   */
  completeStream(request: AICompletionRequest, onToken: (delta: string) => void): Promise<AICompletionResult>;
}
