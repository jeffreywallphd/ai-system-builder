import type {
  AuditCategoryPayloadDto,
  AuditEventDetailViewDto,
  AuditEventSummaryViewDto,
} from "@shared/contracts/audit/AuditEventContracts";
import type { AuditLedgerListQueryDto } from "@shared/dto/audit/AuditEventDtos";
import {
  AuditLedgerQueryErrorCodes,
  type AuditLedgerQueryError,
  type AuditLedgerQueryService,
} from "./AuditLedgerQueryService";

export const AuditGovernanceProjectionFacetKeys = Object.freeze({
  eventType: "eventType",
  outcome: "outcome",
  category: "category",
});

export type AuditGovernanceProjectionFacetKey =
  typeof AuditGovernanceProjectionFacetKeys[keyof typeof AuditGovernanceProjectionFacetKeys];

export interface AuditGovernanceProjectionFacetOption {
  readonly value: string;
  readonly count: number;
}

export interface AuditGovernanceProjectionFacet {
  readonly key: AuditGovernanceProjectionFacetKey;
  readonly options: ReadonlyArray<AuditGovernanceProjectionFacetOption>;
}

export interface GovernanceAuditEventSummaryProjection {
  readonly eventId: string;
  readonly eventType: string;
  readonly category: string;
  readonly action: string;
  readonly outcome: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly summary: string;
  readonly actorId: string;
  readonly actorKind: string;
  readonly workspaceId?: string;
  readonly targetRef?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData: boolean;
  readonly redactionReasons: ReadonlyArray<string>;
}

export interface GovernanceAuditEventDetailProjection {
  readonly summary: GovernanceAuditEventSummaryProjection;
  readonly visibility: "user-safe" | "admin";
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly explanatory: {
    readonly roleSensitivity: "workspace-member" | "workspace-admin";
    readonly notes: ReadonlyArray<string>;
  };
}

export interface GovernanceAuditProjectionList {
  readonly events: ReadonlyArray<GovernanceAuditEventSummaryProjection>;
  readonly facets: ReadonlyArray<AuditGovernanceProjectionFacet>;
  readonly totalCount: number;
  readonly query: AuditLedgerListQueryDto;
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly returned: number;
    readonly hasMore: boolean;
  };
  readonly explanatory: {
    readonly detailVisibility: "user-safe";
    readonly facetCoverage: "page";
    readonly notes: ReadonlyArray<string>;
  };
}

export type GovernanceAuditProjectionListOutcome =
  | {
    readonly ok: true;
    readonly value: GovernanceAuditProjectionList;
  }
  | {
    readonly ok: false;
    readonly error: AuditLedgerQueryError;
  };

export type GovernanceAuditProjectionDetailOutcome =
  | {
    readonly ok: true;
    readonly value: GovernanceAuditEventDetailProjection;
  }
  | {
    readonly ok: false;
    readonly error: AuditLedgerQueryError;
  };

export interface AuditGovernanceProjectionQueryServiceDependencies {
  readonly auditLedgerQueryService: Pick<AuditLedgerQueryService, "listAuditEvents" | "getAuditEventDetail">;
  readonly projectionPolicy?: AuditGovernanceProjectionPolicy;
}

export interface AuditGovernanceProjectionPolicy {
  buildFacets?(input: {
    readonly events: ReadonlyArray<GovernanceAuditEventSummaryProjection>;
  }): ReadonlyArray<AuditGovernanceProjectionFacet>;
  summarizeEvent?(input: {
    readonly event: AuditEventSummaryViewDto | AuditEventDetailViewDto;
  }): string | undefined;
  resolveTargetRef?(input: {
    readonly event: AuditEventSummaryViewDto | AuditEventDetailViewDto;
  }): string | undefined;
  listExplanatoryNotes?(input: {
    readonly projection: "list" | "detail";
    readonly visibility: "user-safe" | "admin";
    readonly event?: AuditEventDetailViewDto;
  }): ReadonlyArray<string>;
  listComplianceExportNotes?(input: {
    readonly projection: "list" | "detail";
    readonly visibility: "user-safe" | "admin";
    readonly event?: AuditEventDetailViewDto;
  }): ReadonlyArray<string>;
}

const UserSafeListNotes = Object.freeze([
  "Summary rows are user-safe by default and never include admin-only detail payloads.",
  "Facet counts are computed from the current result page to keep list responses bounded.",
]);

const UserSafeDetailNotes = Object.freeze([
  "Detail view excludes admin-only diagnostic payloads for non-admin readers.",
]);

const AdminDetailNotes = Object.freeze([
  "Admin detail includes admin-only diagnostic payloads when policy allows.",
  "Redaction reasons indicate which sensitive fields were withheld or transformed.",
]);

export class AuditGovernanceProjectionQueryService {
  public constructor(private readonly dependencies: AuditGovernanceProjectionQueryServiceDependencies) {}

  public async listGovernanceAuditEvents(input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }): Promise<GovernanceAuditProjectionListOutcome> {
    const outcome = await this.dependencies.auditLedgerQueryService.listAuditEvents(input);
    if (!outcome.ok) {
      return outcome;
    }

    const events = Object.freeze(outcome.value.response.events.map((event) => this.toGovernanceSummary(event)));
    return {
      ok: true,
      value: Object.freeze({
        events,
        facets: this.buildFacets(events),
        totalCount: outcome.value.response.totalCount,
        query: outcome.value.response.query,
        pagination: outcome.value.pagination,
        explanatory: Object.freeze({
          detailVisibility: "user-safe",
          facetCoverage: "page",
          notes: this.listNotes({
            projection: "list",
            visibility: "user-safe",
            baseline: UserSafeListNotes,
          }),
        }),
      }),
    };
  }

  public async getGovernanceAuditEventDetail(input: {
    readonly requesterId: string;
    readonly workspaceId?: string;
    readonly eventId: string;
  }): Promise<GovernanceAuditProjectionDetailOutcome> {
    const outcome = await this.dependencies.auditLedgerQueryService.getAuditEventDetail(input);
    if (!outcome.ok) {
      return outcome;
    }

    const event = outcome.value.event;
    const roleSensitivity = event.visibility === "admin" ? "workspace-admin" : "workspace-member";
    return {
      ok: true,
      value: Object.freeze({
        summary: this.toGovernanceSummary(event),
        visibility: event.visibility,
        adminOnlyDetails: event.adminOnlyDetails,
        explanatory: Object.freeze({
          roleSensitivity,
          notes: this.listNotes({
            projection: "detail",
            visibility: event.visibility,
            event,
            baseline: event.visibility === "admin" ? AdminDetailNotes : UserSafeDetailNotes,
          }),
        }),
      }),
    };
  }

  private toGovernanceSummary(
    event: AuditEventSummaryViewDto | AuditEventDetailViewDto,
  ): GovernanceAuditEventSummaryProjection {
    return Object.freeze({
      eventId: event.eventId,
      eventType: event.eventType,
      category: event.category,
      action: event.action,
      outcome: event.outcome,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      summary: this.resolveSummary(event),
      actorId: event.actorId,
      actorKind: event.actorKind,
      workspaceId: event.scope.workspaceId,
      targetRef: this.resolveTargetRef(event),
      details: event.details,
      hasProtectedData: event.hasProtectedData,
      redactionReasons: event.redactionReasons,
    });
  }

  private resolveSummary(
    event: AuditEventSummaryViewDto | AuditEventDetailViewDto,
  ): string {
    const policySummary = this.dependencies.projectionPolicy?.summarizeEvent?.({ event })?.trim();
    if (policySummary) {
      return policySummary;
    }

    return deriveSummary(event);
  }

  private resolveTargetRef(
    event: AuditEventSummaryViewDto | AuditEventDetailViewDto,
  ): string | undefined {
    const policyTargetRef = this.dependencies.projectionPolicy?.resolveTargetRef?.({ event })?.trim();
    if (policyTargetRef) {
      return policyTargetRef;
    }

    return deriveTargetRef(event);
  }

  private buildFacets(
    events: ReadonlyArray<GovernanceAuditEventSummaryProjection>,
  ): ReadonlyArray<AuditGovernanceProjectionFacet> {
    const policyFacets = this.dependencies.projectionPolicy?.buildFacets?.({
      events,
    });
    if (policyFacets && policyFacets.length > 0) {
      return Object.freeze(policyFacets.map((facet) => Object.freeze({
        ...facet,
        options: Object.freeze([...facet.options]),
      })));
    }

    return buildFacets(events);
  }

  private listNotes(input: {
    readonly projection: "list" | "detail";
    readonly visibility: "user-safe" | "admin";
    readonly event?: AuditEventDetailViewDto;
    readonly baseline: ReadonlyArray<string>;
  }): ReadonlyArray<string> {
    const extensionNotes = this.dependencies.projectionPolicy?.listExplanatoryNotes?.({
      projection: input.projection,
      visibility: input.visibility,
      event: input.event,
    }) ?? [];
    const complianceExportNotes = this.dependencies.projectionPolicy?.listComplianceExportNotes?.({
      projection: input.projection,
      visibility: input.visibility,
      event: input.event,
    }) ?? [];

    const combined = new Set<string>();
    for (const note of [...input.baseline, ...extensionNotes, ...complianceExportNotes]) {
      const normalized = note.trim();
      if (normalized) {
        combined.add(normalized);
      }
    }
    return Object.freeze([...combined.values()]);
  }
}

function deriveSummary(
  event: AuditEventSummaryViewDto | AuditEventDetailViewDto,
): string {
  const categoryPayloadSummary = deriveCategoryPayloadSummary(event.categoryPayload);
  if (categoryPayloadSummary) {
    return `${categoryPayloadSummary} (${event.outcome})`;
  }

  return `${event.action} (${event.outcome})`;
}

function deriveCategoryPayloadSummary(
  payload: AuditCategoryPayloadDto | undefined,
): string | undefined {
  if (!payload) {
    return undefined;
  }

  switch (payload.category) {
    case "administrative":
      return payload.targetRef
        ? `${payload.mutationKind} ${payload.targetRef}`
        : payload.mutationKind;
    case "sharing":
      return payload.targetPrincipalRef
        ? `sharing ${payload.sharingOperation} ${payload.targetPrincipalRef}`
        : `sharing ${payload.sharingOperation}`;
    case "policy":
      return payload.policyId
        ? `policy ${payload.changeKind ?? "updated"} ${payload.policyId}`
        : `policy ${payload.changeKind ?? "updated"}`;
    case "orchestration":
      return payload.runId
        ? `run governance ${payload.runId}`
        : "run governance";
    case "protected-data":
      return payload.resourceLocator
        ? `protected data access ${payload.resourceLocator}`
        : "protected data access";
    case "security-sensitive":
      return payload.principalRef
        ? `security principal ${payload.principalRef}`
        : "security-sensitive access";
    default:
      return undefined;
  }
}

function deriveTargetRef(
  event: AuditEventSummaryViewDto | AuditEventDetailViewDto,
): string | undefined {
  if (event.protectedResource?.resourceRef) {
    return event.protectedResource.resourceRef;
  }

  const related = event.linkage?.relatedResources?.[0]?.resourceRef;
  if (related) {
    return related;
  }

  if (event.linkage?.runId) {
    return `run:${event.linkage.runId}`;
  }

  if (event.linkage?.workflowId) {
    return `workflow:${event.linkage.workflowId}`;
  }

  if (event.linkage?.sessionRef) {
    return `session:${event.linkage.sessionRef}`;
  }

  return undefined;
}

function buildFacets(
  events: ReadonlyArray<GovernanceAuditEventSummaryProjection>,
): ReadonlyArray<AuditGovernanceProjectionFacet> {
  return Object.freeze([
    Object.freeze({
      key: AuditGovernanceProjectionFacetKeys.eventType,
      options: countFacetOptions(events.map((event) => event.eventType)),
    }),
    Object.freeze({
      key: AuditGovernanceProjectionFacetKeys.outcome,
      options: countFacetOptions(events.map((event) => event.outcome)),
    }),
    Object.freeze({
      key: AuditGovernanceProjectionFacetKeys.category,
      options: countFacetOptions(events.map((event) => event.category)),
    }),
  ]);
}

function countFacetOptions(values: ReadonlyArray<string>): ReadonlyArray<AuditGovernanceProjectionFacetOption> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Object.freeze(
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([value, count]) => Object.freeze({ value, count })),
  );
}

export function isGovernanceProjectionNotFound(error: AuditLedgerQueryError): boolean {
  return error.code === AuditLedgerQueryErrorCodes.notFound;
}
