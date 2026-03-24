export const AgentExecutionSessionStatuses = Object.freeze({
  queued: "queued",
  planning: "planning",
  running: "running",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
});

export type AgentExecutionSessionStatus = typeof AgentExecutionSessionStatuses[keyof typeof AgentExecutionSessionStatuses];

export interface AgentExecutionSession {
  readonly id: string;
  readonly agentId: string;
  readonly planId?: string;
  readonly status: AgentExecutionSessionStatus;
  readonly executionRunIds: ReadonlyArray<string>;
  readonly diagnosticAssetIds: ReadonlyArray<string>;
  readonly startTime: string;
  readonly endTime?: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeList(values: ReadonlyArray<string> | undefined): ReadonlyArray<string> {
  return Object.freeze((values ?? []).map((value) => value.trim()).filter(Boolean));
}

export function createAgentExecutionSession(input: {
  readonly id: string;
  readonly agentId: string;
  readonly planId?: string;
  readonly status?: AgentExecutionSessionStatus;
  readonly executionRunIds?: ReadonlyArray<string>;
  readonly diagnosticAssetIds?: ReadonlyArray<string>;
  readonly startTime?: Date;
}): AgentExecutionSession {
  const start = input.startTime ?? new Date();

  return Object.freeze({
    id: normalizeRequired(input.id, "Agent execution session id"),
    agentId: normalizeRequired(input.agentId, "Agent execution session agentId"),
    planId: input.planId?.trim() || undefined,
    status: input.status ?? AgentExecutionSessionStatuses.queued,
    executionRunIds: normalizeList(input.executionRunIds),
    diagnosticAssetIds: normalizeList(input.diagnosticAssetIds),
    startTime: start.toISOString(),
    endTime: undefined,
  });
}

export function transitionAgentExecutionSession(
  session: AgentExecutionSession,
  transition: {
    readonly status: AgentExecutionSessionStatus;
    readonly appendExecutionRunId?: string;
    readonly appendDiagnosticAssetId?: string;
    readonly endedAt?: Date;
  },
): AgentExecutionSession {
  const executionRunIds = transition.appendExecutionRunId
    ? Object.freeze([...session.executionRunIds, normalizeRequired(transition.appendExecutionRunId, "Agent execution run id")])
    : session.executionRunIds;

  const diagnosticAssetIds = transition.appendDiagnosticAssetId
    ? Object.freeze([...session.diagnosticAssetIds, normalizeRequired(transition.appendDiagnosticAssetId, "Agent diagnostic asset id")])
    : session.diagnosticAssetIds;

  const terminalStatus = transition.status === AgentExecutionSessionStatuses.completed
    || transition.status === AgentExecutionSessionStatuses.failed
    || transition.status === AgentExecutionSessionStatuses.cancelled;

  return Object.freeze({
    ...session,
    status: transition.status,
    executionRunIds,
    diagnosticAssetIds,
    endTime: terminalStatus ? (transition.endedAt ?? new Date()).toISOString() : undefined,
  });
}
