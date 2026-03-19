export interface McpToolExecutionRequest {
  readonly serverId: string;
  readonly toolName: string;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly executionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
