export interface McpToolInvocationTrace {
  readonly executionId: string;
  readonly serverId: string;
  readonly toolName: string;
  readonly startedAt: string;
  readonly finishedAt?: string;
  readonly status: "running" | "completed" | "failed";
  readonly requestArguments?: Readonly<Record<string, unknown>>;
  readonly rawResult?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
  readonly diagnostics?: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export interface McpToolExecutionResult {
  readonly executionId: string;
  readonly serverId: string;
  readonly toolName: string;
  readonly status: "completed" | "failed";
  readonly content: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly structuredContent?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly trace?: McpToolInvocationTrace;
  readonly errorMessage?: string;
}
