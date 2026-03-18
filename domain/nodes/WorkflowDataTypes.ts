export interface ChatMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

export interface Document {
  readonly id?: string;
  readonly text: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
