import {
  AuditEventDetailVisibilities,
  AuditEventSortFields,
  AuditEventThinSafeCategories,
  normalizeAuditEventListQuery,
  type AuditEventListFiltersDto,
} from "@shared/contracts/audit/AuditEventContracts";
import {
  toAuditLedgerGetDetailResponseDto,
  toAuditLedgerListResponseDto,
  type AuditLedgerGetDetailResponseDto,
  type AuditLedgerListQueryDto,
  type AuditLedgerListResponseDto,
} from "@shared/dto/audit/AuditEventDtos";
import { SharedApiSortDirections } from "@shared/contracts/api/SharedApiContractPrimitives";
import { parseAuditEventListQueryDto, type AuditEventSchemaValidationError } from "@shared/schemas/audit/AuditEventSchemaContracts";
import type { AuditEventCategory, CanonicalAuditEvent } from "@domain/audit/AuditDomain";
import type { AuditLedgerQuery, IAuditLedgerRepository } from "../ports/AuditLedgerPersistencePorts";

export const AuditLedgerQueryErrorCodes = Object.freeze({
  invalidRequest: "audit-ledger-query-invalid-request",
  forbidden: "audit-ledger-query-forbidden",
  notFound: "audit-ledger-query-not-found",
});

export type AuditLedgerQueryErrorCode =
  typeof AuditLedgerQueryErrorCodes[keyof typeof AuditLedgerQueryErrorCodes];

export interface AuditLedgerQueryError {
  readonly code: AuditLedgerQueryErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type AuditLedgerListQueryOutcome =
  | {
    readonly ok: true;
    readonly value: {
      readonly response: AuditLedgerListResponseDto;
      readonly pagination: {
        readonly limit: number;
        readonly offset: number;
        readonly returned: number;
        readonly hasMore: boolean;
      };
    };
  }
  | {
    readonly ok: false;
    readonly error: AuditLedgerQueryError;
  };

export type AuditLedgerGetDetailOutcome =
  | {
    readonly ok: true;
    readonly value: AuditLedgerGetDetailResponseDto;
  }
  | {
    readonly ok: false;
    readonly error: AuditLedgerQueryError;
  };

export interface AuditLedgerQueryReadScope {
  readonly workspaceIds?: ReadonlyArray<string>;
  readonly actorIds?: ReadonlyArray<string>;
  readonly resourceTypes?: ReadonlyArray<string>;
  readonly resourceIds?: ReadonlyArray<string>;
  readonly allowedCategories?: ReadonlyArray<AuditEventCategory>;
  readonly enforceThinSafeOnly?: boolean;
  readonly canReadProtectedData?: boolean;
  readonly detailVisibility?: "none" | "user-safe" | "admin";
}

export interface AuditLedgerQueryAuthorizer {
  authorizeAuditLedgerRead(input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }): Promise<{
    readonly allowed: boolean;
    readonly scope?: AuditLedgerQueryReadScope;
    readonly reason?: string;
  }>;
}

interface AuditLedgerQueryServiceDependencies {
  readonly repository: IAuditLedgerRepository;
  readonly authorizer: AuditLedgerQueryAuthorizer;
}

type ParsedAuditLedgerListQueryResult =
  | {
    readonly ok: true;
    readonly value: AuditLedgerListQueryDto;
  }
  | {
    readonly ok: false;
    readonly error: AuditLedgerQueryError;
  };

const DefaultLimit = 25;
const MaxLimit = 200;

export class AuditLedgerQueryService {
  public constructor(private readonly dependencies: AuditLedgerQueryServiceDependencies) {}

  public async listAuditEvents(input: {
    readonly requesterId: string;
    readonly query: AuditLedgerListQueryDto;
  }): Promise<AuditLedgerListQueryOutcome> {
    const requesterId = normalizeOptionalString(input.requesterId);
    if (!requesterId) {
      return this.failure(AuditLedgerQueryErrorCodes.invalidRequest, "requesterId is required.");
    }

    const parsedQuery = this.parseQuery(input.query);
    if (!parsedQuery.ok) {
      return {
        ok: false,
        error: parsedQuery.error,
      };
    }

    const authorization = await this.dependencies.authorizer.authorizeAuditLedgerRead({
      requesterId,
      query: parsedQuery.value,
    });

    if (!authorization.allowed) {
      return this.failure(
        AuditLedgerQueryErrorCodes.forbidden,
        authorization.reason?.trim() || "Requester is not authorized to read audit ledger events.",
      );
    }

    const scoped = applyScopeToQuery(parsedQuery.value, authorization.scope);
    if (scoped.empty) {
      return {
        ok: true,
        value: {
          response: toAuditLedgerListResponseDto({
            events: [],
            query: scoped.query,
            totalCount: 0,
          }),
          pagination: Object.freeze({
            limit: scoped.limit,
            offset: scoped.offset,
            returned: 0,
            hasMore: false,
          }),
        },
      };
    }

    const totalCount = await this.dependencies.repository.countAuditEvents(scoped.query);
    const window = await this.dependencies.repository.listAuditEvents({
      ...scoped.query,
      pagination: Object.freeze({
        limit: scoped.limit + 1,
        offset: scoped.offset,
      }),
      limit: scoped.limit + 1,
      offset: scoped.offset,
    } satisfies AuditLedgerQuery);

    const hasMore = window.length > scoped.limit;
    const events = hasMore ? window.slice(0, scoped.limit) : window;

    return {
      ok: true,
      value: {
        response: toAuditLedgerListResponseDto({
          events,
          query: scoped.query,
          totalCount,
        }),
        pagination: Object.freeze({
          limit: scoped.limit,
          offset: scoped.offset,
          returned: events.length,
          hasMore,
        }),
      },
    };
  }

  public async getAuditEventDetail(input: {
    readonly requesterId: string;
    readonly eventId: string;
    readonly workspaceId?: string;
  }): Promise<AuditLedgerGetDetailOutcome> {
    const requesterId = normalizeOptionalString(input.requesterId);
    if (!requesterId) {
      return this.failure(AuditLedgerQueryErrorCodes.invalidRequest, "requesterId is required.");
    }

    const eventId = normalizeOptionalString(input.eventId);
    if (!eventId) {
      return this.failure(AuditLedgerQueryErrorCodes.invalidRequest, "eventId is required.");
    }

    const event = await this.dependencies.repository.getAuditEventById(eventId);
    if (!event) {
      return this.failure(
        AuditLedgerQueryErrorCodes.notFound,
        `Audit event '${eventId}' was not found.`,
      );
    }

    const scopedWorkspaceId = normalizeOptionalString(input.workspaceId) ?? event.scope.workspaceId;
    const authorization = await this.dependencies.authorizer.authorizeAuditLedgerRead({
      requesterId,
      query: Object.freeze({
        workspaceId: scopedWorkspaceId,
      }),
    });
    if (!authorization.allowed) {
      return this.failure(
        AuditLedgerQueryErrorCodes.forbidden,
        authorization.reason?.trim() || "Requester is not authorized to read audit ledger events.",
      );
    }

    if (!canReadEventWithScope(event, authorization.scope)) {
      return this.failure(
        AuditLedgerQueryErrorCodes.notFound,
        `Audit event '${eventId}' was not found.`,
      );
    }

    const detailVisibility = authorization.scope?.detailVisibility === "admin"
      ? AuditEventDetailVisibilities.admin
      : AuditEventDetailVisibilities.userSafe;

    return {
      ok: true,
      value: toAuditLedgerGetDetailResponseDto({
        event,
        visibility: detailVisibility,
      }),
    };
  }

  private parseQuery(query: AuditLedgerListQueryDto): ParsedAuditLedgerListQueryResult {
    try {
      const parsed = parseAuditEventListQueryDto(query);
      const normalized = normalizeAuditEventListQuery(parsed);
      const limit = normalizeLimit(normalized.pagination?.limit);
      const offset = normalizeOffset(normalized.pagination?.offset);
      return {
        ok: true,
        value: Object.freeze({
          ...normalized,
          pagination: Object.freeze({
            limit,
            offset,
          }),
          sorting: Object.freeze({
            sortBy: normalized.sorting?.sortBy ?? AuditEventSortFields.occurredAt,
            sortDirection: normalized.sorting?.sortDirection ?? SharedApiSortDirections.descending,
          }),
        }),
      };
    } catch (error) {
      const schemaError = error as AuditEventSchemaValidationError;
      return {
        ok: false,
        error: Object.freeze({
          code: AuditLedgerQueryErrorCodes.invalidRequest,
          message: "Audit ledger query is invalid.",
          details: schemaError.issues ? Object.freeze({ issues: schemaError.issues }) : undefined,
        }),
      };
    }
  }

  private failure(
    code: AuditLedgerQueryErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AuditLedgerListQueryOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function applyScopeToQuery(
  query: AuditLedgerListQueryDto,
  scope: AuditLedgerQueryReadScope | undefined,
): { readonly query: AuditLedgerListQueryDto; readonly limit: number; readonly offset: number; readonly empty: boolean } {
  const baseFilters = query.filters;

  const workspaceScope = normalizeStringSet(scope?.workspaceIds);
  const actorScope = normalizeStringSet(scope?.actorIds);
  const resourceTypeScope = normalizeStringSet(scope?.resourceTypes);
  const resourceIdScope = normalizeStringSet(scope?.resourceIds);

  const requestedWorkspaceIds = normalizeStringSet([
    ...toArray(query.workspaceId),
    ...toArray(baseFilters?.workspaceIds),
  ]) ?? new Set<string>();
  const requestedActorIds = normalizeStringSet(baseFilters?.actorIds) ?? new Set<string>();
  const requestedResourceTypes = normalizeStringSet(baseFilters?.resourceTypes) ?? new Set<string>();
  const requestedResourceIds = normalizeStringSet(baseFilters?.resourceIds) ?? new Set<string>();
  const requestedCategories = normalizeStringSet(baseFilters?.categories) ?? new Set<string>();

  const effectiveWorkspaceIds = intersectIfScoped(requestedWorkspaceIds, workspaceScope);
  if (workspaceScope && effectiveWorkspaceIds.size < 1) {
    return {
      query,
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
      empty: true,
    };
  }

  const effectiveActorIds = intersectIfScoped(requestedActorIds, actorScope);
  if (actorScope && effectiveActorIds.size < 1) {
    return {
      query,
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
      empty: true,
    };
  }

  const effectiveResourceTypes = intersectIfScoped(requestedResourceTypes, resourceTypeScope);
  if (resourceTypeScope && effectiveResourceTypes.size < 1) {
    return {
      query,
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
      empty: true,
    };
  }

  const effectiveResourceIds = intersectIfScoped(requestedResourceIds, resourceIdScope);
  if (resourceIdScope && effectiveResourceIds.size < 1) {
    return {
      query,
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
      empty: true,
    };
  }

  const categoryScope = normalizeStringSet(scope?.allowedCategories);
  const effectiveCategories = intersectIfScoped(requestedCategories, categoryScope);
  if (categoryScope && effectiveCategories.size < 1) {
    return {
      query,
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
      empty: true,
    };
  }

  const canReadProtectedData = scope?.canReadProtectedData !== false;
  const hasProtectedData = baseFilters?.hasProtectedData;
  if (!canReadProtectedData && hasProtectedData === true) {
    return {
      query,
      limit: normalizeLimit(query.pagination?.limit),
      offset: normalizeOffset(query.pagination?.offset),
      empty: true,
    };
  }

  const filters: AuditEventListFiltersDto = Object.freeze({
    ...baseFilters,
    workspaceIds: effectiveWorkspaceIds.size > 0 ? Object.freeze([...effectiveWorkspaceIds]) : undefined,
    actorIds: effectiveActorIds.size > 0 ? Object.freeze([...effectiveActorIds]) : undefined,
    resourceTypes: effectiveResourceTypes.size > 0 ? Object.freeze([...effectiveResourceTypes]) : undefined,
    resourceIds: effectiveResourceIds.size > 0 ? Object.freeze([...effectiveResourceIds]) : undefined,
    categories: effectiveCategories.size > 0
      ? Object.freeze([...effectiveCategories] as AuditEventCategory[])
      : undefined,
    hasProtectedData: !canReadProtectedData ? false : hasProtectedData,
    includeThinSafeOnly: scope?.enforceThinSafeOnly ? true : baseFilters?.includeThinSafeOnly,
  });

  const workspaceId = effectiveWorkspaceIds.size === 1
    ? [...effectiveWorkspaceIds][0]
    : query.workspaceId;

  const limit = normalizeLimit(query.pagination?.limit);
  const offset = normalizeOffset(query.pagination?.offset);

  return {
    query: Object.freeze({
      ...query,
      workspaceId,
      pagination: Object.freeze({ limit, offset }),
      filters,
      sorting: Object.freeze({
        sortBy: query.sorting?.sortBy ?? AuditEventSortFields.occurredAt,
        sortDirection: query.sorting?.sortDirection ?? SharedApiSortDirections.descending,
      }),
    }),
    limit,
    offset,
    empty: false,
  };
}

function canReadEventWithScope(
  event: CanonicalAuditEvent,
  scope: AuditLedgerQueryReadScope | undefined,
): boolean {
  const workspaceScope = normalizeStringSet(scope?.workspaceIds);
  if (workspaceScope && !workspaceScope.has(event.scope.workspaceId ?? "")) {
    return false;
  }

  const actorScope = normalizeStringSet(scope?.actorIds);
  if (actorScope && !actorScope.has(event.actor.actorId)) {
    return false;
  }

  const resourceTypeScope = normalizeStringSet(scope?.resourceTypes);
  if (resourceTypeScope) {
    const eventResourceType = event.protectedResource?.resourceType ?? "";
    if (!resourceTypeScope.has(eventResourceType)) {
      return false;
    }
  }

  const resourceIdScope = normalizeStringSet(scope?.resourceIds);
  if (resourceIdScope) {
    const eventResourceId = event.protectedResource?.resourceId ?? "";
    if (!resourceIdScope.has(eventResourceId)) {
      return false;
    }
  }

  const categoryScope = normalizeStringSet(scope?.allowedCategories);
  if (categoryScope && !categoryScope.has(event.category)) {
    return false;
  }

  const includeThinSafeOnly = scope?.enforceThinSafeOnly === true;
  if (includeThinSafeOnly && !AuditEventThinSafeCategories.includes(event.category)) {
    return false;
  }

  const canReadProtectedData = scope?.canReadProtectedData !== false;
  if (!canReadProtectedData && event.payload.hasProtectedData) {
    return false;
  }

  if (scope?.detailVisibility === "none") {
    return false;
  }

  return true;
}

function intersectIfScoped(
  requested: ReadonlySet<string>,
  scope: ReadonlySet<string> | undefined,
): ReadonlySet<string> {
  if (!scope) {
    return requested;
  }

  if (requested.size < 1) {
    return scope;
  }

  const intersection = new Set<string>();
  for (const value of requested) {
    if (scope.has(value)) {
      intersection.add(value);
    }
  }

  return intersection;
}

function toArray(values?: ReadonlyArray<string> | string): ReadonlyArray<string> {
  if (!values) {
    return [];
  }
  return Array.isArray(values) ? values : [values];
}

function normalizeStringSet(values?: ReadonlyArray<string>): ReadonlySet<string> | undefined {
  if (!values || values.length < 1) {
    return undefined;
  }

  const set = new Set<string>();
  for (const value of values) {
    const normalized = normalizeOptionalString(value);
    if (normalized) {
      set.add(normalized);
    }
  }
  return set.size > 0 ? set : undefined;
}

function normalizeOptionalString(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeLimit(value?: number): number {
  if (!Number.isInteger(value) || (value ?? 0) <= 0) {
    return DefaultLimit;
  }
  return Math.min(value as number, MaxLimit);
}

function normalizeOffset(value?: number): number {
  if (!Number.isInteger(value) || (value ?? -1) < 0) {
    return 0;
  }
  return value as number;
}
