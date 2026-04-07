import type { ExecutionContextEnvelope } from "../../context/models/ExecutionContextEnvelope";
import type { AgentExecutionResult } from "../../agents/models/AgentExecutionResult";
import type { ToolCapabilityDescriptor } from "../../tools/models/ToolCapabilityDescriptor";

export interface AgentToolOrchestrationRequest {
  readonly input: string;
  readonly executionId?: string;
  readonly maxIterations: number;
  readonly availableTools: ReadonlyArray<ToolCapabilityDescriptor>;
  readonly selectedTools: ReadonlyArray<ToolCapabilityDescriptor>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly context?: ExecutionContextEnvelope;
}

export interface IAgentToolOrchestrator {
  execute(request: AgentToolOrchestrationRequest): Promise<AgentExecutionResult>;
}
