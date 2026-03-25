export const AgentRuntimeEventTypes = Object.freeze({
  executionStarted: "execution-started",
  planPrepared: "plan-prepared",
  governanceValidated: "governance-validated",
  unitMapped: "unit-mapped",
  unitCompleted: "unit-completed",
  executionBlocked: "execution-blocked",
  executionFailed: "execution-failed",
  memoryPersisted: "memory-persisted",
});

export type AgentRuntimeEventType = typeof AgentRuntimeEventTypes[keyof typeof AgentRuntimeEventTypes];

export interface AgentRuntimeProgressEvent {
  readonly type: AgentRuntimeEventType;
  readonly occurredAt: string;
  readonly executionId: string;
  readonly agentId: string;
  readonly planId?: string;
  readonly stepId?: string;
  readonly status?: "completed" | "failed" | "cancelled" | "blocked";
  readonly metadata?: Readonly<Record<string, unknown>>;
}
