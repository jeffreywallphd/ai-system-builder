export interface McpToolExecutionResult {
  readonly executionId: string;
  readonly serverId: string;
  readonly toolName: string;
  readonly status: "completed" | "failed";
  readonly content: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly structuredContent?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}
