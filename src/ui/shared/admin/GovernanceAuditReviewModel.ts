import type { SharedApiListQueryConventions, SharedApiListQuerySorting } from "@shared/contracts/api/SharedApiQueryConventions";

export const GovernanceAuditEventTypes = Object.freeze({
  session: "identity-session-issued",
  deviceRevocation: "identity-trusted-device-revoked",
  nodeApproval: "node-enrollment-approved",
  permissionChange: "authorization-sharing-granted",
  runGovernance: "run-submission-evaluated",
});

export type GovernanceAuditEventType = string;

export const GovernanceAuditEventOutcomes = Object.freeze({
  succeeded: "succeeded",
  denied: "denied",
  failed: "failed",
  rejected: "rejected",
});

export type GovernanceAuditEventOutcome =
  typeof GovernanceAuditEventOutcomes[keyof typeof GovernanceAuditEventOutcomes];

export interface GovernanceAuditEventRecord {
  readonly eventId: string;
  readonly eventType: GovernanceAuditEventType;
  readonly occurredAt: string;
  readonly outcome: GovernanceAuditEventOutcome;
  readonly summary: string;
  readonly workspaceId?: string;
  readonly actorId?: string;
  readonly targetRef?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface GovernanceAuditReviewListQuery extends SharedApiListQueryConventions {
  readonly eventTypes?: ReadonlyArray<GovernanceAuditEventType>;
  readonly outcomes?: ReadonlyArray<GovernanceAuditEventOutcome>;
  readonly includeThinSafeOnly?: boolean;
}

export interface GovernanceAuditReviewListResult {
  readonly events: ReadonlyArray<GovernanceAuditEventRecord>;
  readonly totalCount: number;
  readonly facets?: ReadonlyArray<GovernanceAuditFacet>;
  readonly explanatory?: GovernanceAuditProjectionExplanatoryMetadata;
}

export interface GovernanceAuditFacetOption {
  readonly value: string;
  readonly count: number;
}

export interface GovernanceAuditFacet {
  readonly key: "eventType" | "outcome" | "category";
  readonly options: ReadonlyArray<GovernanceAuditFacetOption>;
}

export interface GovernanceAuditProjectionExplanatoryMetadata {
  readonly detailVisibility: "user-safe";
  readonly facetCoverage: "page";
  readonly notes: ReadonlyArray<string>;
}

export const GovernanceAuditSortBy = Object.freeze({
  occurredAt: "occurredAt",
  eventType: "eventType",
} as const);

export type GovernanceAuditSortBy = typeof GovernanceAuditSortBy[keyof typeof GovernanceAuditSortBy];

export const GovernanceAuditQueryDefaults: Required<Pick<SharedApiListQueryConventions, "pagination" | "sorting">> = Object.freeze({
  pagination: Object.freeze({
    limit: 25,
    offset: 0,
  }),
  sorting: Object.freeze({
    sortBy: GovernanceAuditSortBy.occurredAt,
    sortDirection: "desc",
  }),
});

export function normalizeGovernanceAuditQuery(
  query: GovernanceAuditReviewListQuery,
): GovernanceAuditReviewListQuery {
  const trimmedSearch = query.search?.trim();
  const search = trimmedSearch && trimmedSearch.length > 0
    ? trimmedSearch.slice(0, 256)
    : undefined;
  return Object.freeze({
    ...query,
    search,
    pagination: Object.freeze({
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
    }),
    sorting: normalizeSorting(query.sorting),
  });
}

function normalizeLimit(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? 0) < 1) {
    return GovernanceAuditQueryDefaults.pagination.limit;
  }
  return Math.min(value as number, 200);
}

function normalizeOffset(value: number | undefined): number {
  if (!Number.isInteger(value) || (value ?? -1) < 0) {
    return GovernanceAuditQueryDefaults.pagination.offset;
  }
  return value as number;
}

function normalizeSorting(sorting: SharedApiListQuerySorting | undefined): SharedApiListQuerySorting {
  const sortBy = sorting?.sortBy === GovernanceAuditSortBy.eventType
    ? GovernanceAuditSortBy.eventType
    : GovernanceAuditSortBy.occurredAt;
  const sortDirection = sorting?.sortDirection === "asc" ? "asc" : "desc";
  return Object.freeze({
    sortBy,
    sortDirection,
  });
}
