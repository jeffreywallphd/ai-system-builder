import type { AgentToolSelection } from "./AgentToolSelection";

export interface AgentExecutionRequest {
  readonly input: string;
  readonly executionId?: string;
  readonly maxIterations?: number;
  readonly toolSelection?: AgentToolSelection;
  readonly context?: Readonly<{
    promptText: string;
    selectedPackageIds?: ReadonlyArray<string>;
    packageLabels?: Readonly<Record<string, string>>;
  }>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
