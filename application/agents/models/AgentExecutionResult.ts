import type { ToolCapabilityDescriptor } from "../../tools/models/ToolCapabilityDescriptor";
import type { AgentStepResult } from "./AgentStepResult";

export interface AgentExecutionResult {
  readonly executionId: string;
  readonly status: "completed" | "failed" | "cancelled";
  readonly input: string;
  readonly maxIterations: number;
  readonly availableTools: ReadonlyArray<ToolCapabilityDescriptor>;
  readonly selectedTools: ReadonlyArray<ToolCapabilityDescriptor>;
  readonly steps: ReadonlyArray<AgentStepResult>;
  readonly finalOutput?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}
