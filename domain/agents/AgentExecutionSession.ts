import { ExecutionStatuses, type ExecutionStatus } from "../execution/ExecutionPlan";
import { AssetId } from "../assets/AssetId";

export const AgentExecutionSessionStatuses = Object.freeze({
  pending: ExecutionStatuses.pending,
  ready: ExecutionStatuses.ready,
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
  readonly planId?: string;
  readonly status?: ExecutionStatus;
}

export interface AgentExecutionDiagnosticReference {
  readonly assetId: AssetId;
  readonly assetVersionId?: string;
}

export interface AgentExecutionSession {
  readonly id: string;
  readonly agentId: string;
  readonly executionPlan?: AgentExecutionPlanReference;
  readonly status: AgentExecutionSessionStatus;
  readonly executionRuns: ReadonlyArray<AgentExecutionRunReference>;
  readonly diagnostics: ReadonlyArray<AgentExecutionDiagnosticReference>;
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

function normalizeDiagnostics(
  values: ReadonlyArray<AgentExecutionDiagnosticReference> | undefined,
): ReadonlyArray<AgentExecutionDiagnosticReference> {
  const deduped = new Set<string>();
  const normalized: AgentExecutionDiagnosticReference[] = [];
  for (const value of values ?? []) {
    const assetId = AssetId.from(value.assetId);
    if (!assetId.toString().startsWith("asset:")) {
      throw new Error(`Agent diagnostic asset id '${assetId.toString()}' must use canonical asset id format.`);
    }
    const assetVersionId = value.assetVersionId?.trim() || undefined;
    if (assetVersionId !== undefined && !/^[a-zA-Z0-9:_-]+$/.test(assetVersionId)) {
      throw new Error(`Agent diagnostic assetVersionId '${assetVersionId}' is malformed.`);
    }
    const diagnosticKey = [assetId.toString(), assetVersionId ?? "latest"].join("|");
    if (diagnosticKey) {
      if (!deduped.has(diagnosticKey)) {
        deduped.add(diagnosticKey);
        normalized.push(Object.freeze({
          assetId,
          assetVersionId,
        }));
      }
    }
  }
  return Object.freeze(normalized);
}

function normalizeExecutionRun(entry: AgentExecutionRunReference, sessionPlanId?: string): AgentExecutionRunReference {
  const runId = normalizeRequired(entry.runId, "Agent execution run id");
  const planId = entry.planId?.trim() || undefined;
  if (planId && sessionPlanId && planId !== sessionPlanId) {
    throw new Error(`Agent execution run '${runId}' planId '${planId}' must match session planId '${sessionPlanId}'.`);
  }
  return Object.freeze({
    runId,
    planId,
    status: entry.status,
  });
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
    pending: Object.freeze([AgentExecutionSessionStatuses.ready, AgentExecutionSessionStatuses.running, AgentExecutionSessionStatuses.failed, AgentExecutionSessionStatuses.cancelled]),
    ready: Object.freeze([AgentExecutionSessionStatuses.running, AgentExecutionSessionStatuses.failed, AgentExecutionSessionStatuses.cancelled]),
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
  readonly diagnostics?: ReadonlyArray<AgentExecutionDiagnosticReference>;
  readonly startTime?: Date;
}): AgentExecutionSession {
  const start = input.startTime ?? new Date();
  const status = input.status ?? AgentExecutionSessionStatuses.pending;

  if (!Object.values(AgentExecutionSessionStatuses).includes(status)) {
    throw new Error("Agent execution session status is invalid.");
  }

  if (isTerminalStatus(status)) {
    throw new Error("Agent execution sessions cannot be created in a terminal status.");
  }

  const planId = input.planId?.trim() || undefined;
  const executionPlan = planId
    ? Object.freeze({ planId })
    : undefined;

  return Object.freeze({
    id: normalizeRequired(input.id, "Agent execution session id"),
    agentId: normalizeRequired(input.agentId, "Agent execution session agentId"),
    executionPlan,
    status,
    executionRuns: Object.freeze((input.executionRuns ?? []).map((entry) => normalizeExecutionRun(entry, planId))),
    diagnostics: normalizeDiagnostics(input.diagnostics),
    startTime: start.toISOString(),
    endTime: undefined,
  });
}

export function transitionAgentExecutionSession(
  session: AgentExecutionSession,
  transition: {
    readonly status: AgentExecutionSessionStatus;
    readonly appendExecutionRun?: AgentExecutionRunReference;
    readonly appendDiagnostic?: AgentExecutionDiagnosticReference;
    readonly endedAt?: Date;
  },
): AgentExecutionSession {
  if (!Object.values(AgentExecutionSessionStatuses).includes(transition.status)) {
    throw new Error("Agent execution session transition status is invalid.");
  }

  assertValidLifecycleTransition(session.status, transition.status);

  const executionRuns = transition.appendExecutionRun
    ? Object.freeze([...session.executionRuns, normalizeExecutionRun(transition.appendExecutionRun, session.executionPlan?.planId)])
    : session.executionRuns;

  const diagnostics = transition.appendDiagnostic
    ? normalizeDiagnostics([...session.diagnostics, transition.appendDiagnostic])
    : session.diagnostics;

  const terminalStatus = isTerminalStatus(transition.status);
  const endTime = terminalStatus ? (transition.endedAt ?? new Date()).toISOString() : undefined;

  if (endTime && new Date(endTime).getTime() < new Date(session.startTime).getTime()) {
    throw new Error("Agent execution session endTime cannot be earlier than startTime.");
  }

  return Object.freeze({
    ...session,
    status: transition.status,
    executionRuns,
    diagnostics,
    endTime,
  });
}
