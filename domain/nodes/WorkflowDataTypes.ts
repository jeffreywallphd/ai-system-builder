export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface Document {
  readonly id?: string;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ToolCall {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema?: Readonly<Record<string, unknown>>;
}
