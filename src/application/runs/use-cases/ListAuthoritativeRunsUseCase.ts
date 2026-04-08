import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { RunSubmissionSource } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { RunLifecycleState } from "@domain/runs/RunDomain";
import type {
  AuthoritativeRunReadAuthorizationActor,
  IAuthoritativeRunQueryAuthorizationPort,
} from "@application/runs/ports/RunQueryAuthorizationPorts";
import { toRunSummaryWithHistoryHints, type RunSummaryWithHistoryHints } from "./RunQueryHistoryProjection";

export const RunCompletionStates = Object.freeze({
  terminal: "terminal",
  nonTerminal: "non-terminal",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
});

export type RunCompletionState = typeof RunCompletionStates[keyof typeof RunCompletionStates];

export interface ListAuthoritativeRunsRequest {
  readonly workspaceId: string;
  readonly authorization?: AuthoritativeRunReadAuthorizationActor;
  readonly runIds?: ReadonlyArray<string>;
  readonly ownerUserIdentityIds?: ReadonlyArray<string>;
  readonly systemIds?: ReadonlyArray<string>;
  readonly workflowIds?: ReadonlyArray<string>;
  readonly states?: ReadonlyArray<RunLifecycleState>;
  readonly completionStates?: ReadonlyArray<RunCompletionState>;
  readonly sources?: ReadonlyArray<RunSubmissionSource>;
  readonly submittedAfter?: string;
  readonly submittedBefore?: string;
  readonly updatedAfter?: string;
  readonly updatedBefore?: string;
  readonly search?: string;
  readonly sortBy?: "submittedAt" | "updatedAt" | "state";
  readonly sortDirection?: "asc" | "desc";
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListAuthoritativeRunsResult {
  readonly items: ReadonlyArray<RunSummaryWithHistoryHints>;
  readonly totalCount: number;
}

export class ListAuthoritativeRunsUseCase {
  public constructor(
    private readonly runRepository: IAuthoritativeRunPersistenceRepository,
    private readonly dependencies: {
      readonly authorization?: IAuthoritativeRunQueryAuthorizationPort;
    } = {},
  ) {}

  public async execute(input: ListAuthoritativeRunsRequest): Promise<ListAuthoritativeRunsResult> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      return Object.freeze({
        items: Object.freeze([]),
        totalCount: 0,
      });
    }

    const actor = normalizeActor(input.authorization);
    if (this.dependencies.authorization && !actor) {
      return Object.freeze({
        items: Object.freeze([]),
        totalCount: 0,
      });
    }
    if (this.dependencies.authorization && actor) {
      const workspaceAllowed = await this.dependencies.authorization.canReadWorkspaceRuns({
        workspaceId,
        actor,
      });
      if (!workspaceAllowed) {
        return Object.freeze({
          items: Object.freeze([]),
          totalCount: 0,
        });
      }
    }

    const ownerUserIdentityIds = normalizeEnumSet(input.ownerUserIdentityIds);
    const platformOwnerFilter = ownerUserIdentityIds.size === 1
      ? [...ownerUserIdentityIds][0]
      : undefined;
    const candidateRuns = await this.runRepository.listRuns(Object.freeze({
      workspaceId,
      userIdentityId: platformOwnerFilter,
      initiatedAfter: normalizeIsoOptional(input.submittedAfter),
      initiatedBefore: normalizeIsoOptional(input.submittedBefore),
    }));

    const search = normalizeOptional(input.search)?.toLowerCase();
    const runIds = normalizeEnumSet(input.runIds);
    const workflowIds = normalizeEnumSet(input.workflowIds);
    const systemIds = normalizeEnumSet(input.systemIds);
    const states = normalizeEnumSet(input.states);
    const completionStates = normalizeEnumSet(input.completionStates);
    const sources = normalizeEnumSet(input.sources);
    const submittedAfter = normalizeIsoOptional(input.submittedAfter);
    const submittedBefore = normalizeIsoOptional(input.submittedBefore);
    const updatedAfter = normalizeIsoOptional(input.updatedAfter);
    const updatedBefore = normalizeIsoOptional(input.updatedBefore);
    const filtered = await filterAsync(
      candidateRuns
        .map((record) => toRunSummaryWithHistoryHints(record))
        .filter((summary) => runIds.size === 0 || runIds.has(summary.runId))
        .filter((summary) => ownerUserIdentityIds.size === 0 || ownerUserIdentityIds.has(summary.ownerUserIdentityId ?? ""))
        .filter((summary) => systemIds.size === 0 || systemIds.has(summary.systemId ?? ""))
        .filter((summary) => workflowIds.size === 0 || workflowIds.has(summary.workflowId))
        .filter((summary) => !submittedAfter || summary.submittedAt >= submittedAfter)
        .filter((summary) => !submittedBefore || summary.submittedAt <= submittedBefore)
        .filter((summary) => !updatedAfter || summary.updatedAt >= updatedAfter)
        .filter((summary) => !updatedBefore || summary.updatedAt <= updatedBefore)
        .filter((summary) => states.size === 0 || states.has(summary.state))
        .filter((summary) => completionStates.size === 0 || completionStates.has(resolveRunCompletionState(summary.state)))
        .filter((summary) => sources.size === 0 || sources.has(summary.source))
        .filter((summary) => !search || matchesSearch(summary, search)),
      async (summary) => {
        if (!this.dependencies.authorization || !actor) {
          return true;
        }
        return this.dependencies.authorization.canReadRun({
          runId: summary.runId,
          workspaceId: summary.workspaceId,
          actor,
        });
      },
    );

    const sorted = sortSummaries(filtered, input.sortBy, input.sortDirection);
    const offset = Math.max(0, input.offset ?? 0);
    const limit = typeof input.limit === "number" ? Math.max(1, input.limit) : undefined;
    const page = typeof limit === "number"
      ? sorted.slice(offset, offset + limit)
      : sorted.slice(offset);

    return Object.freeze({
      items: Object.freeze(page),
      totalCount: sorted.length,
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoOptional(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }
  return new Date(parsed).toISOString();
}

function normalizeEnumSet<TValue extends string>(values: ReadonlyArray<TValue> | undefined): ReadonlySet<TValue> {
  const normalized = values
    ?.map((value) => value.trim())
    .filter((value): value is TValue => value.length > 0);
  return new Set(normalized ?? []);
}

function normalizeActor(
  actor: AuthoritativeRunReadAuthorizationActor | undefined,
): AuthoritativeRunReadAuthorizationActor | undefined {
  const actorUserIdentityId = normalizeOptional(actor?.actorUserIdentityId);
  if (!actorUserIdentityId) {
    return undefined;
  }
  return Object.freeze({
    actorUserIdentityId,
    activeWorkspaceId: normalizeOptional(actor?.activeWorkspaceId),
    authenticatedAt: normalizeOptional(actor?.authenticatedAt),
  });
}

function resolveRunCompletionState(state: RunLifecycleState): RunCompletionState {
  if (state === "completed") {
    return RunCompletionStates.succeeded;
  }
  if (state === "failed") {
    return RunCompletionStates.failed;
  }
  if (state === "cancelled") {
    return RunCompletionStates.cancelled;
  }
  if (state === "submitted"
    || state === "queued"
    || state === "assignment-pending"
    || state === "assigned"
    || state === "dispatching"
    || state === "running"
    || state === "cancelling"
    || state === "retry-pending") {
    return RunCompletionStates.nonTerminal;
  }
  return RunCompletionStates.terminal;
}

function matchesSearch(summary: RunSummaryWithHistoryHints, search: string): boolean {
  return summary.runId.toLowerCase().includes(search)
    || summary.workflowId.toLowerCase().includes(search)
    || summary.state.toLowerCase().includes(search)
    || (summary.workspaceId?.toLowerCase().includes(search) ?? false)
    || (summary.systemId?.toLowerCase().includes(search) ?? false)
    || (summary.ownerUserIdentityId?.toLowerCase().includes(search) ?? false);
}

async function filterAsync<TValue>(
  values: ReadonlyArray<TValue>,
  predicate: (value: TValue) => Promise<boolean>,
): Promise<ReadonlyArray<TValue>> {
  const accepted: TValue[] = [];
  for (const value of values) {
    if (await predicate(value)) {
      accepted.push(value);
    }
  }
  return Object.freeze(accepted);
}

function sortSummaries(
  summaries: ReadonlyArray<RunSummaryWithHistoryHints>,
  sortBy?: "submittedAt" | "updatedAt" | "state",
  sortDirection?: "asc" | "desc",
): ReadonlyArray<RunSummaryWithHistoryHints> {
  const direction = sortDirection === "asc" ? 1 : -1;
  const field = sortBy ?? "updatedAt";
  const sorted = [...summaries].sort((left, right) => {
    if (field === "state") {
      return direction * left.state.localeCompare(right.state);
    }
    if (field === "submittedAt") {
      return direction * left.submittedAt.localeCompare(right.submittedAt);
    }
    return direction * left.updatedAt.localeCompare(right.updatedAt);
  });
  return Object.freeze(sorted);
}
