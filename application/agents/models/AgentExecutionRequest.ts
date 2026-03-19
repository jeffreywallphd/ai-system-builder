import type { AgentToolSelection } from "./AgentToolSelection";

export interface AgentExecutionRequest {
  readonly input: string;
  readonly executionId?: string;
  readonly maxIterations?: number;
  readonly toolSelection?: AgentToolSelection;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
