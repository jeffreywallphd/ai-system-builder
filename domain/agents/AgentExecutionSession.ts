import { ExecutionStatuses, type ExecutionStatus } from "../execution/ExecutionPlan";

export const AgentExecutionSessionStatuses = Object.freeze({
  ready: ExecutionStatuses.ready,
  planning: "planning",
  running: ExecutionStatuses.running,
  completed: ExecutionStatuses.completed,
  failed: ExecutionStatuses.failed,
  cancelled: ExecutionStatuses.cancelled,
});

export type AgentExecutionSessionStatus = typeof AgentExecutionSessionStatuses[keyof typeof AgentExecutionSessionStatuses];

export interface AgentExecutionPlanReference {
  readonly planId: string;
}

export interface AgentExecutionRunReference {
  readonly runId: string;
  readonly status?: ExecutionStatus;
}

export interface AgentExecutionSession {
  readonly id: string;
  readonly agentId: string;
  readonly executionPlan?: AgentExecutionPlanReference;
  readonly status: AgentExecutionSessionStatus;
  readonly executionRuns: ReadonlyArray<AgentExecutionRunReference>;
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
    ready: Object.freeze([AgentExecutionSessionStatuses.planning, AgentExecutionSessionStatuses.running, AgentExecutionSessionStatuses.cancelled]),
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
  readonly executionRuns?: ReadonlyArray<AgentExecutionRunReference>;
  readonly diagnosticAssetIds?: ReadonlyArray<string>;
  readonly startTime?: Date;
}): AgentExecutionSession {
  const start = input.startTime ?? new Date();
  const status = input.status ?? AgentExecutionSessionStatuses.ready;

  if (!Object.values(AgentExecutionSessionStatuses).includes(status)) {
    throw new Error("Agent execution session status is invalid.");
  }

  if (isTerminalStatus(status)) {
    throw new Error("Agent execution sessions cannot be created in a terminal status.");
  }

  const executionPlan = input.planId?.trim()
    ? Object.freeze({ planId: input.planId.trim() })
    : undefined;

  return Object.freeze({
    id: normalizeRequired(input.id, "Agent execution session id"),
    agentId: normalizeRequired(input.agentId, "Agent execution session agentId"),
    executionPlan,
    status,
    executionRuns: Object.freeze((input.executionRuns ?? []).map((entry) => Object.freeze({
      runId: normalizeRequired(entry.runId, "Agent execution run id"),
      status: entry.status,
    }))),
    diagnosticAssetIds: normalizeList(input.diagnosticAssetIds),
    startTime: start.toISOString(),
    endTime: undefined,
  });
}

export function transitionAgentExecutionSession(
  session: AgentExecutionSession,
  transition: {
    readonly status: AgentExecutionSessionStatus;
    readonly appendExecutionRun?: AgentExecutionRunReference;
    readonly appendDiagnosticAssetId?: string;
    readonly endedAt?: Date;
  },
): AgentExecutionSession {
  if (!Object.values(AgentExecutionSessionStatuses).includes(transition.status)) {
    throw new Error("Agent execution session transition status is invalid.");
  }

  assertValidLifecycleTransition(session.status, transition.status);

  const executionRuns = transition.appendExecutionRun
    ? Object.freeze([...session.executionRuns, Object.freeze({
      runId: normalizeRequired(transition.appendExecutionRun.runId, "Agent execution run id"),
      status: transition.appendExecutionRun.status,
    })])
    : session.executionRuns;

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
    executionRuns,
    diagnosticAssetIds,
    endTime,
  });
}
