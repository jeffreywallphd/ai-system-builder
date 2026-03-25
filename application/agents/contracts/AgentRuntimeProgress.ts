export const AgentRuntimeEventTypes = Object.freeze({
  executionStarted: "execution-started",
  sessionStarted: "session-started",
  sessionTransitioned: "session-transitioned",
  sessionPersisted: "session-persisted",
  planPrepared: "plan-prepared",
  governanceValidated: "governance-validated",
  unitMapped: "unit-mapped",
  stepAttemptStarted: "step-attempt-started",
  unitCompleted: "unit-completed",
  unitFailed: "unit-failed",
  unitCancelled: "unit-cancelled",
  unitBlocked: "unit-blocked",
  retryScheduled: "retry-scheduled",
  retryExhausted: "retry-exhausted",
  executionBlocked: "execution-blocked",
  executionFailed: "execution-failed",
  executionCompleted: "execution-completed",
  executionCancelled: "execution-cancelled",
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
