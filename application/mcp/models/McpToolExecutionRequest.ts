import type { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";

export interface McpToolExecutionRequest {
  readonly context?: ExecutionContextEnvelope;
  readonly serverId: string;
  readonly toolName: string;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly executionId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
