import type { IAuthoritativeRunPersistenceRepository } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type { RunSummary } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { toRunSummary, type RunSubmissionSource } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { RunLifecycleState } from "@domain/runs/RunDomain";
import { mapPlatformRunRecordToCanonicalRun } from "./RunCreationPersistenceMapper";

export interface ListAuthoritativeRunsRequest {
  readonly workspaceId: string;
  readonly states?: ReadonlyArray<RunLifecycleState>;
  readonly sources?: ReadonlyArray<RunSubmissionSource>;
  readonly search?: string;
  readonly sortBy?: "submittedAt" | "updatedAt" | "state";
  readonly sortDirection?: "asc" | "desc";
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListAuthoritativeRunsResult {
  readonly items: ReadonlyArray<RunSummary>;
  readonly totalCount: number;
}

export class ListAuthoritativeRunsUseCase {
  public constructor(private readonly runRepository: IAuthoritativeRunPersistenceRepository) {}

  public async execute(input: ListAuthoritativeRunsRequest): Promise<ListAuthoritativeRunsResult> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      return Object.freeze({
        items: Object.freeze([]),
        totalCount: 0,
      });
    }

    const candidateRuns = await this.runRepository.listRuns(Object.freeze({
      workspaceId,
    }));

    const search = normalizeOptional(input.search)?.toLowerCase();
    const states = normalizeEnumSet(input.states);
    const sources = normalizeEnumSet(input.sources);
    const filtered = candidateRuns
      .map((record) => toRunSummary(mapPlatformRunRecordToCanonicalRun(record)))
      .filter((summary) => states.size === 0 || states.has(summary.state))
      .filter((summary) => sources.size === 0 || sources.has(summary.source))
      .filter((summary) => !search || matchesSearch(summary, search));

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

function normalizeEnumSet<TValue extends string>(values: ReadonlyArray<TValue> | undefined): ReadonlySet<TValue> {
  const normalized = values
    ?.map((value) => value.trim())
    .filter((value): value is TValue => value.length > 0);
  return new Set(normalized ?? []);
}

function matchesSearch(summary: RunSummary, search: string): boolean {
  return summary.runId.toLowerCase().includes(search)
    || summary.workflowId.toLowerCase().includes(search)
    || summary.state.toLowerCase().includes(search)
    || (summary.workspaceId?.toLowerCase().includes(search) ?? false);
}

function sortSummaries(
  summaries: ReadonlyArray<RunSummary>,
  sortBy?: "submittedAt" | "updatedAt" | "state",
  sortDirection?: "asc" | "desc",
): ReadonlyArray<RunSummary> {
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
