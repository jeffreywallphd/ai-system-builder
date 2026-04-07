import type {
  AuditActorIdentity,
  AuditActorKind,
  AuditEventCategory,
  AuditEventOutcome,
  AuditLifecycleState,
  AuditImmutabilityPosture,
  AuditProtectedResourceReference,
  AuditRedactionReason,
  AuditRetentionAnchorKind,
  AuditRetentionPosture,
  AuditScope,
} from "@domain/audit/AuditDomain";
import {
  AuditEventCategories,
  AuditEventOutcomes,
  AuditRedactionReasons,
} from "@domain/audit/AuditDomain";
import type { SharedApiListQueryConventions } from "../api/SharedApiQueryConventions";

export class AuditEventContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditEventContractError";
  }
}

export const AuditEventContractVersions = Object.freeze({
  v1: "1.0",
});

export type AuditEventContractVersion =
  typeof AuditEventContractVersions[keyof typeof AuditEventContractVersions];

export const AuditEventDetailVisibilities = Object.freeze({
  userSafe: "user-safe",
  admin: "admin",
});

export type AuditEventDetailVisibility =
  typeof AuditEventDetailVisibilities[keyof typeof AuditEventDetailVisibilities];

export const AuditEventSortFields = Object.freeze({
  occurredAt: "occurredAt",
  recordedAt: "recordedAt",
  eventType: "eventType",
  category: "category",
  outcome: "outcome",
  actorId: "actorId",
} as const);

export type AuditEventSortField =
  typeof AuditEventSortFields[keyof typeof AuditEventSortFields];

export interface AuditEventActorReferenceDto extends AuditActorIdentity {}

export interface AuditEventScopeReferenceDto extends AuditScope {}

export interface AuditEventResourceReferenceDto extends AuditProtectedResourceReference {}

export interface AuditEventRelatedResourceReferenceDto {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly resourceRef: string;
  readonly relationship: string;
  readonly workspaceId?: string;
}

export interface AuditEventLinkageDto {
  readonly eventGroupId?: string;
  readonly parentEventId?: string;
  readonly rootEventId?: string;
  readonly workflowId?: string;
  readonly sessionRef?: string;
  readonly runId?: string;
  readonly governanceActionId?: string;
  readonly relatedResources?: ReadonlyArray<AuditEventRelatedResourceReferenceDto>;
}

export interface SecuritySensitiveAuditCategoryPayloadDto {
  readonly category: typeof AuditEventCategories.securitySensitive;
  readonly principalRef?: string;
  readonly authenticationMethod?: string;
  readonly riskLevel?: "low" | "medium" | "high";
}

export interface AdministrativeAuditCategoryPayloadDto {
  readonly category: typeof AuditEventCategories.administrative;
  readonly mutationKind: string;
  readonly targetType?: string;
  readonly targetRef?: string;
}

export interface SharingAuditCategoryPayloadDto {
  readonly category: typeof AuditEventCategories.sharing;
  readonly sharingOperation: "grant" | "revoke" | "visibility-change";
  readonly targetPrincipalRef?: string;
  readonly permissionKeys?: ReadonlyArray<string>;
}

export interface PolicyAuditCategoryPayloadDto {
  readonly category: typeof AuditEventCategories.policy;
  readonly policyScope?: string;
  readonly policyId?: string;
  readonly changeKind?: string;
}

export interface OrchestrationAuditCategoryPayloadDto {
  readonly category: typeof AuditEventCategories.orchestration;
  readonly runId?: string;
  readonly queueId?: string;
  readonly nodeId?: string;
  readonly decisionId?: string;
}

export interface ProtectedDataAuditCategoryPayloadDto {
  readonly category: typeof AuditEventCategories.protectedData;
  readonly dataClass?: string;
  readonly accessPath?: string;
  readonly resourceLocator?: string;
}

export type AuditCategoryPayloadDto =
  | SecuritySensitiveAuditCategoryPayloadDto
  | AdministrativeAuditCategoryPayloadDto
  | SharingAuditCategoryPayloadDto
  | PolicyAuditCategoryPayloadDto
  | OrchestrationAuditCategoryPayloadDto
  | ProtectedDataAuditCategoryPayloadDto;

export interface AuditEventPayloadDto {
  readonly categoryPayload?: AuditCategoryPayloadDto;
  readonly userSafeDetails?: Readonly<Record<string, unknown>>;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData: boolean;
  readonly redactionReasons: ReadonlyArray<AuditRedactionReason>;
}

export interface AuditEventRetentionMetadataDto {
  readonly policyKey?: string;
  readonly policyVersion?: string;
  readonly retentionAnchor: AuditRetentionAnchorKind;
  readonly retainUntil?: string;
  readonly archiveAfter?: string;
  readonly lifecycleState: AuditLifecycleState;
  readonly lifecycleUpdatedAt?: string;
}

export interface AuditEventEnvelopeDto {
  readonly contractVersion: AuditEventContractVersion;
  readonly eventId: string;
  readonly eventType: string;
  readonly category: AuditEventCategory;
  readonly action: string;
  readonly outcome: AuditEventOutcome;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly actor: AuditEventActorReferenceDto;
  readonly scope: AuditEventScopeReferenceDto;
  readonly protectedResource?: AuditEventResourceReferenceDto;
  readonly payload: AuditEventPayloadDto;
  readonly retention?: AuditRetentionPosture;
  readonly retentionMetadata?: AuditEventRetentionMetadataDto;
  readonly immutability: AuditImmutabilityPosture;
  readonly schemaVersion: string;
  readonly hashAlgorithm: string;
  readonly eventDigest?: string;
  readonly previousEventDigest?: string;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly linkage?: AuditEventLinkageDto;
}

export interface AuditEventSummaryViewDto {
  readonly eventId: string;
  readonly eventType: string;
  readonly category: AuditEventCategory;
  readonly action: string;
  readonly outcome: AuditEventOutcome;
  readonly occurredAt: string;
  readonly recordedAt: string;
  readonly actorId: string;
  readonly actorKind: AuditActorKind;
  readonly scope: AuditEventScopeReferenceDto;
  readonly protectedResource?: AuditEventResourceReferenceDto;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly linkage?: AuditEventLinkageDto;
  readonly categoryPayload?: AuditCategoryPayloadDto;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly hasProtectedData: boolean;
  readonly redactionReasons: ReadonlyArray<AuditRedactionReason>;
  readonly retention: AuditRetentionPosture;
  readonly retentionMetadata?: AuditEventRetentionMetadataDto;
}

export interface AuditEventDetailViewDto extends AuditEventSummaryViewDto {
  readonly visibility: AuditEventDetailVisibility;
  readonly adminOnlyDetails?: Readonly<Record<string, unknown>>;
}

export interface AuditEventListFiltersDto {
  readonly categories?: ReadonlyArray<AuditEventCategory>;
  readonly outcomes?: ReadonlyArray<AuditEventOutcome>;
  readonly eventTypes?: ReadonlyArray<string>;
  readonly actions?: ReadonlyArray<string>;
  readonly actionPrefix?: string;
  readonly actorIds?: ReadonlyArray<string>;
  readonly workspaceIds?: ReadonlyArray<string>;
  readonly resourceTypes?: ReadonlyArray<string>;
  readonly resourceIds?: ReadonlyArray<string>;
  readonly correlationIds?: ReadonlyArray<string>;
  readonly requestIds?: ReadonlyArray<string>;
  readonly eventGroupIds?: ReadonlyArray<string>;
  readonly rootEventIds?: ReadonlyArray<string>;
  readonly parentEventIds?: ReadonlyArray<string>;
  readonly workflowIds?: ReadonlyArray<string>;
  readonly sessionRefs?: ReadonlyArray<string>;
  readonly runIds?: ReadonlyArray<string>;
  readonly governanceActionIds?: ReadonlyArray<string>;
  readonly retentionPostures?: ReadonlyArray<AuditRetentionPosture>;
  readonly lifecycleStates?: ReadonlyArray<AuditLifecycleState>;
  readonly retentionPolicyKeys?: ReadonlyArray<string>;
  readonly retainUntilAfter?: string;
  readonly retainUntilBefore?: string;
  readonly hasProtectedData?: boolean;
  readonly occurredAfter?: string;
  readonly occurredBefore?: string;
  readonly includeThinSafeOnly?: boolean;
}

export interface AuditEventListQueryDto extends SharedApiListQueryConventions {
  readonly filters?: AuditEventListFiltersDto;
}

function toFrozenStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values || values.length < 1) {
    return undefined;
  }

  const normalized = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return normalized.length > 0 ? Object.freeze([...new Set(normalized)]) : undefined;
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalBoolean(value: boolean | undefined): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeTimestamp(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new AuditEventContractError(`Audit query timestamp '${normalized}' is invalid.`);
  }

  return parsed.toISOString();
}

export function normalizeAuditEventListQuery(
  query: AuditEventListQueryDto,
): AuditEventListQueryDto {
  const normalizedFilters = query.filters
    ? Object.freeze({
      categories: toFrozenStringArray(query.filters.categories) as ReadonlyArray<AuditEventCategory> | undefined,
      outcomes: toFrozenStringArray(query.filters.outcomes) as ReadonlyArray<AuditEventOutcome> | undefined,
      eventTypes: toFrozenStringArray(query.filters.eventTypes),
      actions: toFrozenStringArray(query.filters.actions),
      actionPrefix: normalizeOptionalString(query.filters.actionPrefix),
      actorIds: toFrozenStringArray(query.filters.actorIds),
      workspaceIds: toFrozenStringArray(query.filters.workspaceIds),
      resourceTypes: toFrozenStringArray(query.filters.resourceTypes),
      resourceIds: toFrozenStringArray(query.filters.resourceIds),
      correlationIds: toFrozenStringArray(query.filters.correlationIds),
      requestIds: toFrozenStringArray(query.filters.requestIds),
      eventGroupIds: toFrozenStringArray(query.filters.eventGroupIds),
      rootEventIds: toFrozenStringArray(query.filters.rootEventIds),
      parentEventIds: toFrozenStringArray(query.filters.parentEventIds),
      workflowIds: toFrozenStringArray(query.filters.workflowIds),
      sessionRefs: toFrozenStringArray(query.filters.sessionRefs),
      runIds: toFrozenStringArray(query.filters.runIds),
      governanceActionIds: toFrozenStringArray(query.filters.governanceActionIds),
      retentionPostures: toFrozenStringArray(query.filters.retentionPostures) as ReadonlyArray<AuditRetentionPosture> | undefined,
      lifecycleStates: toFrozenStringArray(query.filters.lifecycleStates) as ReadonlyArray<AuditLifecycleState> | undefined,
      retentionPolicyKeys: toFrozenStringArray(query.filters.retentionPolicyKeys),
      retainUntilAfter: normalizeTimestamp(query.filters.retainUntilAfter),
      retainUntilBefore: normalizeTimestamp(query.filters.retainUntilBefore),
      hasProtectedData: normalizeOptionalBoolean(query.filters.hasProtectedData),
      occurredAfter: normalizeTimestamp(query.filters.occurredAfter),
      occurredBefore: normalizeTimestamp(query.filters.occurredBefore),
      includeThinSafeOnly: normalizeOptionalBoolean(query.filters.includeThinSafeOnly),
    })
    : undefined;

  return Object.freeze({
    ...query,
    workspaceId: normalizeOptionalString(query.workspaceId),
    actorWorkspaceId: normalizeOptionalString(query.actorWorkspaceId),
    search: normalizeOptionalString(query.search),
    pagination: query.pagination
      ? Object.freeze({
        limit: query.pagination.limit,
        offset: query.pagination.offset,
      })
      : undefined,
    sorting: query.sorting
      ? Object.freeze({
        sortBy: normalizeOptionalString(query.sorting.sortBy),
        sortDirection: query.sorting.sortDirection,
      })
      : undefined,
    filters: normalizedFilters,
  });
}

export function toAuditEventSummaryView(event: AuditEventEnvelopeDto): AuditEventSummaryViewDto {
  return Object.freeze({
    eventId: event.eventId,
    eventType: event.eventType,
    category: event.category,
    action: event.action,
    outcome: event.outcome,
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
    actorId: event.actor.actorId,
    actorKind: event.actor.actorKind,
    scope: event.scope,
    protectedResource: event.protectedResource,
    correlationId: event.correlationId,
    requestId: event.requestId,
    linkage: event.linkage,
    categoryPayload: event.payload.categoryPayload,
    details: event.payload.userSafeDetails,
    hasProtectedData: event.payload.hasProtectedData,
    redactionReasons: event.payload.redactionReasons,
    retention: event.retention,
    retentionMetadata: event.retentionMetadata,
  });
}

export function toAuditEventDetailView(
  event: AuditEventEnvelopeDto,
  visibility: AuditEventDetailVisibility = AuditEventDetailVisibilities.userSafe,
): AuditEventDetailViewDto {
  const summary = toAuditEventSummaryView(event);
  return Object.freeze({
    ...summary,
    visibility,
    adminOnlyDetails: visibility === AuditEventDetailVisibilities.admin
      ? event.payload.adminOnlyDetails
      : undefined,
  });
}

export const AuditEventThinSafeCategories = Object.freeze([
  AuditEventCategories.administrative,
  AuditEventCategories.orchestration,
  AuditEventCategories.sharing,
] satisfies ReadonlyArray<AuditEventCategory>);

export const AuditEventAllOutcomes = Object.freeze([
  AuditEventOutcomes.succeeded,
  AuditEventOutcomes.denied,
  AuditEventOutcomes.failed,
  AuditEventOutcomes.rejected,
] satisfies ReadonlyArray<AuditEventOutcome>);

export const AuditEventAllRedactionReasons = Object.freeze([
  AuditRedactionReasons.secretMaterial,
  AuditRedactionReasons.token,
  AuditRedactionReasons.credential,
  AuditRedactionReasons.personalData,
  AuditRedactionReasons.internalOnlyDiagnostic,
] satisfies ReadonlyArray<AuditRedactionReason>);
