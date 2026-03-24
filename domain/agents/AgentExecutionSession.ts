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
  const deduped = new Set<string>();
  for (const value of values ?? []) {
    const normalized = value.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped]);
}

function isTerminalStatus(status: AgentExecutionSessionStatus): boolean {
  return status === AgentExecutionSessionStatuses.completed
    || status === AgentExecutionSessionStatuses.failed
    || status === AgentExecutionSessionStatuses.cancelled;
}

function assertValidLifecycleTransition(
  from: AgentExecutionSessionStatus,
  to: AgentExecutionSessionStatus,
): void {
  const allowedTransitions: Readonly<Record<AgentExecutionSessionStatus, ReadonlyArray<AgentExecutionSessionStatus>>> = {
    queued: Object.freeze([AgentExecutionSessionStatuses.planning, AgentExecutionSessionStatuses.running, AgentExecutionSessionStatuses.cancelled]),
    planning: Object.freeze([AgentExecutionSessionStatuses.running, AgentExecutionSessionStatuses.failed, AgentExecutionSessionStatuses.cancelled]),
    running: Object.freeze([AgentExecutionSessionStatuses.completed, AgentExecutionSessionStatuses.failed, AgentExecutionSessionStatuses.cancelled]),
    completed: Object.freeze([]),
    failed: Object.freeze([]),
    cancelled: Object.freeze([]),
  };

  if (from === to) {
    return;
  }

  if (!allowedTransitions[from].includes(to)) {
    throw new Error(`Invalid agent execution session transition '${from}' -> '${to}'.`);
  }
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
  const status = input.status ?? AgentExecutionSessionStatuses.queued;

  if (!Object.values(AgentExecutionSessionStatuses).includes(status)) {
    throw new Error("Agent execution session status is invalid.");
  }

  if (isTerminalStatus(status)) {
    throw new Error("Agent execution sessions cannot be created in a terminal status.");
  }

  return Object.freeze({
    id: normalizeRequired(input.id, "Agent execution session id"),
    agentId: normalizeRequired(input.agentId, "Agent execution session agentId"),
    planId: input.planId?.trim() || undefined,
    status,
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
  if (!Object.values(AgentExecutionSessionStatuses).includes(transition.status)) {
    throw new Error("Agent execution session transition status is invalid.");
  }

  assertValidLifecycleTransition(session.status, transition.status);

  const executionRunIds = transition.appendExecutionRunId
    ? normalizeList([...session.executionRunIds, normalizeRequired(transition.appendExecutionRunId, "Agent execution run id")])
    : session.executionRunIds;

  const diagnosticAssetIds = transition.appendDiagnosticAssetId
    ? normalizeList([...session.diagnosticAssetIds, normalizeRequired(transition.appendDiagnosticAssetId, "Agent diagnostic asset id")])
    : session.diagnosticAssetIds;

  const terminalStatus = isTerminalStatus(transition.status);
  const endTime = terminalStatus ? (transition.endedAt ?? new Date()).toISOString() : undefined;

  if (endTime && new Date(endTime).getTime() < new Date(session.startTime).getTime()) {
    throw new Error("Agent execution session endTime cannot be earlier than startTime.");
  }

  return Object.freeze({
    ...session,
    status: transition.status,
    executionRunIds,
    diagnosticAssetIds,
    endTime,
  });
}
