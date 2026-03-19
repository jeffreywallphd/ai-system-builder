import type { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";

import type { AgentToolSelection } from "./AgentToolSelection";

export interface AgentExecutionRequest {
  readonly input: string;
  readonly executionId?: string;
  readonly maxIterations?: number;
  readonly toolSelection?: AgentToolSelection;
  readonly context?: ExecutionContextEnvelope;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
