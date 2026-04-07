import { z } from "zod";
import {
  AuditActorKinds,
  AuditEventCategories,
  AuditEventOutcomes,
  AuditImmutabilityPostures,
  AuditRedactionReasons,
  AuditResourceSensitivityClasses,
  AuditRetentionPostures,
  AuditScopeKinds,
} from "@domain/audit/AuditDomain";
import { SharedApiQueryParamKeys, SharedApiSortDirections } from "../../contracts/api/SharedApiQueryConventions";
import {
  AuditEventContractVersions,
  AuditEventSortFields,
  AuditEventThinSafeCategories,
} from "../../contracts/audit/AuditEventContracts";
import type { AuditEventEnvelopeDto, AuditEventListQueryDto } from "../../contracts/audit/AuditEventContracts";
import type { AuditLedgerAppendRequestDto } from "../../dto/audit/AuditEventDtos";

type AuditQueryFilters = NonNullable<AuditEventListQueryDto["filters"]>;
type AuditQueryCategories = AuditQueryFilters["categories"];
type AuditQueryOutcomes = AuditQueryFilters["outcomes"];

export interface AuditEventSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class AuditEventSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<AuditEventSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<AuditEventSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "AuditEventSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(255);
const TimestampSchema = z.string().datetime({ offset: true });
const OutcomeSchema = z.enum([
  AuditEventOutcomes.succeeded,
  AuditEventOutcomes.denied,
  AuditEventOutcomes.failed,
  AuditEventOutcomes.rejected,
]);
const CategorySchema = z.enum([
  AuditEventCategories.securitySensitive,
  AuditEventCategories.administrative,
  AuditEventCategories.sharing,
  AuditEventCategories.policy,
  AuditEventCategories.orchestration,
  AuditEventCategories.protectedData,
]);

const ActorSchema = z.object({
  actorId: IdentifierSchema,
  actorKind: z.enum([
    AuditActorKinds.user,
    AuditActorKinds.service,
    AuditActorKinds.system,
  ]),
  actorUserIdentityId: IdentifierSchema.optional(),
  actorServiceId: IdentifierSchema.optional(),
  actorSessionId: IdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.actorKind === AuditActorKinds.user && !value.actorUserIdentityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actorUserIdentityId"],
      message: "User actors require actorUserIdentityId.",
    });
  }

  if (value.actorKind === AuditActorKinds.service && !value.actorServiceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actorServiceId"],
      message: "Service actors require actorServiceId.",
    });
  }
});

const ScopeSchema = z.object({
  kind: z.enum([
    AuditScopeKinds.global,
    AuditScopeKinds.workspace,
  ]),
  workspaceId: IdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.kind === AuditScopeKinds.workspace && !value.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["workspaceId"],
      message: "Workspace scope requires workspaceId.",
    });
  }

  if (value.kind === AuditScopeKinds.global && value.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["workspaceId"],
      message: "Global scope cannot define workspaceId.",
    });
  }
});

const ProtectedResourceSchema = z.object({
  resourceType: IdentifierSchema,
  resourceId: IdentifierSchema,
  resourceRef: z.string().trim().min(1).max(512),
  sensitivityClass: z.enum([
    AuditResourceSensitivityClasses.standard,
    AuditResourceSensitivityClasses.sensitive,
    AuditResourceSensitivityClasses.protected,
  ]),
  workspaceId: IdentifierSchema.optional(),
}).strict();

const LinkageRelatedResourceSchema = z.object({
  resourceType: z.string().trim().min(1).max(255),
  resourceId: IdentifierSchema,
  resourceRef: z.string().trim().min(1).max(512),
  relationship: z.string().trim().min(1).max(128),
  workspaceId: IdentifierSchema.optional(),
}).strict();

const LinkageSchema = z.object({
  eventGroupId: IdentifierSchema.optional(),
  parentEventId: IdentifierSchema.optional(),
  rootEventId: IdentifierSchema.optional(),
  workflowId: IdentifierSchema.optional(),
  sessionRef: z.string().trim().min(1).max(255).optional(),
  runId: IdentifierSchema.optional(),
  governanceActionId: IdentifierSchema.optional(),
  relatedResources: z.array(LinkageRelatedResourceSchema).max(16).optional(),
}).strict().superRefine((value, context) => {
  if (value.rootEventId && value.parentEventId && value.rootEventId === value.parentEventId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rootEventId"],
      message: "rootEventId cannot match parentEventId.",
    });
  }
});

const CategoryPayloadSchema = z.discriminatedUnion("category", [
  z.object({
    category: z.literal(AuditEventCategories.securitySensitive),
    principalRef: IdentifierSchema.optional(),
    authenticationMethod: z.string().trim().min(1).max(64).optional(),
    riskLevel: z.enum(["low", "medium", "high"]).optional(),
  }).strict(),
  z.object({
    category: z.literal(AuditEventCategories.administrative),
    mutationKind: z.string().trim().min(1).max(128),
    targetType: z.string().trim().min(1).max(128).optional(),
    targetRef: z.string().trim().min(1).max(255).optional(),
  }).strict(),
  z.object({
    category: z.literal(AuditEventCategories.sharing),
    sharingOperation: z.enum(["grant", "revoke", "visibility-change"]),
    targetPrincipalRef: IdentifierSchema.optional(),
    permissionKeys: z.array(z.string().trim().min(1).max(255)).max(32).optional(),
  }).strict(),
  z.object({
    category: z.literal(AuditEventCategories.policy),
    policyScope: z.string().trim().min(1).max(128).optional(),
    policyId: IdentifierSchema.optional(),
    changeKind: z.string().trim().min(1).max(128).optional(),
  }).strict(),
  z.object({
    category: z.literal(AuditEventCategories.orchestration),
    runId: IdentifierSchema.optional(),
    queueId: IdentifierSchema.optional(),
    nodeId: IdentifierSchema.optional(),
    decisionId: IdentifierSchema.optional(),
  }).strict(),
  z.object({
    category: z.literal(AuditEventCategories.protectedData),
    dataClass: z.string().trim().min(1).max(128).optional(),
    accessPath: z.string().trim().min(1).max(255).optional(),
    resourceLocator: z.string().trim().min(1).max(1024).optional(),
  }).strict(),
]);

const PayloadSchema = z.object({
  categoryPayload: CategoryPayloadSchema.optional(),
  userSafeDetails: z.record(z.string(), z.unknown()).optional(),
  adminOnlyDetails: z.record(z.string(), z.unknown()).optional(),
  hasProtectedData: z.boolean(),
  redactionReasons: z.array(z.enum([
    AuditRedactionReasons.secretMaterial,
    AuditRedactionReasons.token,
    AuditRedactionReasons.credential,
    AuditRedactionReasons.personalData,
    AuditRedactionReasons.internalOnlyDiagnostic,
  ])).max(16),
}).strict().superRefine((value, context) => {
  if (value.hasProtectedData && value.redactionReasons.length < 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["redactionReasons"],
      message: "Payloads with protected data require redactionReasons.",
    });
  }

  if (!value.hasProtectedData && value.adminOnlyDetails && Object.keys(value.adminOnlyDetails).length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hasProtectedData"],
      message: "adminOnlyDetails require hasProtectedData=true.",
    });
  }
});

export const AuditEventEnvelopeDtoSchema: z.ZodType<AuditEventEnvelopeDto> = z.object({
  contractVersion: z.enum([
    AuditEventContractVersions.v1,
  ]),
  eventId: IdentifierSchema,
  eventType: z.string().trim().min(1).max(255),
  category: CategorySchema,
  action: z.string().trim().min(1).max(255),
  outcome: OutcomeSchema,
  occurredAt: TimestampSchema,
  recordedAt: TimestampSchema,
  actor: ActorSchema,
  scope: ScopeSchema,
  protectedResource: ProtectedResourceSchema.optional(),
  payload: PayloadSchema,
  retention: z.enum([
    AuditRetentionPostures.operational,
    AuditRetentionPostures.governance,
    AuditRetentionPostures.legalHold,
  ]),
  immutability: z.enum([
    AuditImmutabilityPostures.appendOnly,
    AuditImmutabilityPostures.appendOnlyHashChained,
  ]),
  schemaVersion: z.string().trim().min(1).max(32),
  hashAlgorithm: z.string().trim().min(1).max(64),
  eventDigest: z.string().trim().min(1).max(1024).optional(),
  previousEventDigest: z.string().trim().min(1).max(1024).optional(),
  correlationId: IdentifierSchema.optional(),
  requestId: IdentifierSchema.optional(),
  linkage: LinkageSchema.optional(),
}).strict().superRefine((value, context) => {
  const occurredAt = Date.parse(value.occurredAt);
  const recordedAt = Date.parse(value.recordedAt);
  if (recordedAt < occurredAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recordedAt"],
      message: "recordedAt cannot be earlier than occurredAt.",
    });
  }

  if (value.payload.categoryPayload && value.payload.categoryPayload.category !== value.category) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["payload", "categoryPayload", "category"],
      message: "payload.categoryPayload.category must match event category.",
    });
  }

  if (
    value.protectedResource?.workspaceId
    && value.scope.kind === AuditScopeKinds.workspace
    && value.protectedResource.workspaceId !== value.scope.workspaceId
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["protectedResource", "workspaceId"],
      message: "protectedResource.workspaceId must match scope.workspaceId.",
    });
  }
});

export const AuditLedgerAppendRequestDtoSchema: z.ZodType<AuditLedgerAppendRequestDto> = z.object({
  event: AuditEventEnvelopeDtoSchema,
  mutation: z.object({
    operationKey: z.string().trim().min(1).max(255),
    actorId: IdentifierSchema,
    occurredAt: TimestampSchema.optional(),
    correlationId: IdentifierSchema.optional(),
  }).strict(),
}).strict();

export const AuditEventListQueryDtoSchema: z.ZodType<AuditEventListQueryDto> = z.object({
  workspaceId: IdentifierSchema.optional(),
  actorWorkspaceId: IdentifierSchema.optional(),
  search: z.string().trim().min(1).max(256).optional(),
  pagination: z.object({
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  }).strict().optional(),
  sorting: z.object({
    sortBy: z.enum([
      AuditEventSortFields.occurredAt,
      AuditEventSortFields.recordedAt,
      AuditEventSortFields.eventType,
      AuditEventSortFields.category,
      AuditEventSortFields.outcome,
      AuditEventSortFields.actorId,
    ]).optional(),
    sortDirection: z.enum([
      SharedApiSortDirections.ascending,
      SharedApiSortDirections.descending,
    ]).optional(),
  }).strict().optional(),
  filters: z.object({
    categories: z.array(CategorySchema).max(12).optional(),
    outcomes: z.array(OutcomeSchema).max(8).optional(),
    eventTypes: z.array(z.string().trim().min(1).max(255)).max(32).optional(),
    actions: z.array(z.string().trim().min(1).max(255)).max(32).optional(),
    actionPrefix: z.string().trim().min(1).max(255).optional(),
    actorIds: z.array(IdentifierSchema).max(64).optional(),
    workspaceIds: z.array(IdentifierSchema).max(64).optional(),
    resourceTypes: z.array(z.string().trim().min(1).max(255)).max(32).optional(),
    resourceIds: z.array(IdentifierSchema).max(64).optional(),
    correlationIds: z.array(IdentifierSchema).max(64).optional(),
    requestIds: z.array(IdentifierSchema).max(64).optional(),
    eventGroupIds: z.array(IdentifierSchema).max(64).optional(),
    rootEventIds: z.array(IdentifierSchema).max(64).optional(),
    parentEventIds: z.array(IdentifierSchema).max(64).optional(),
    workflowIds: z.array(IdentifierSchema).max(64).optional(),
    sessionRefs: z.array(z.string().trim().min(1).max(255)).max(64).optional(),
    runIds: z.array(IdentifierSchema).max(64).optional(),
    governanceActionIds: z.array(IdentifierSchema).max(64).optional(),
    hasProtectedData: z.boolean().optional(),
    occurredAfter: TimestampSchema.optional(),
    occurredBefore: TimestampSchema.optional(),
    includeThinSafeOnly: z.boolean().optional(),
  }).strict().optional(),
}).strict().superRefine((value, context) => {
  if (
    value.filters?.occurredAfter
    && value.filters?.occurredBefore
    && Date.parse(value.filters.occurredAfter) > Date.parse(value.filters.occurredBefore)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["filters", "occurredAfter"],
      message: "occurredAfter cannot be later than occurredBefore.",
    });
  }

  if (value.filters?.includeThinSafeOnly && value.filters.categories?.length) {
    const invalid = value.filters.categories.filter((category) => !AuditEventThinSafeCategories.includes(category));
    if (invalid.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filters", "categories"],
        message: `includeThinSafeOnly does not allow categories: ${invalid.join(", ")}.`,
      });
    }
  }
});

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): AuditEventSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new AuditEventSchemaValidationError(schemaName, issues);
}

function parseSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

function parseOptionalString(values: string[]): string | undefined {
  const normalized = values
    .map((value) => value.trim())
    .find((value) => value.length > 0);
  return normalized;
}

function parseOptionalBoolean(values: string[]): boolean | undefined {
  const value = parseOptionalString(values);
  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function parseOptionalNumber(values: string[]): number | undefined {
  const value = parseOptionalString(values);
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function parseAuditEventEnvelopeDto(payload: unknown): AuditEventEnvelopeDto {
  return parseSchema("AuditEventEnvelopeDto", AuditEventEnvelopeDtoSchema, payload);
}

export function parseAuditLedgerAppendRequestDto(payload: unknown): AuditLedgerAppendRequestDto {
  return parseSchema("AuditLedgerAppendRequestDto", AuditLedgerAppendRequestDtoSchema, payload);
}

export function parseAuditEventListQueryDto(payload: unknown): AuditEventListQueryDto {
  return parseSchema("AuditEventListQueryDto", AuditEventListQueryDtoSchema, payload);
}

export function parseAuditEventListQueryFromSearchParams(searchParams: URLSearchParams): AuditEventListQueryDto {
  const payload: AuditEventListQueryDto = Object.freeze({
    workspaceId: parseOptionalString(searchParams.getAll(SharedApiQueryParamKeys.workspaceId)),
    actorWorkspaceId: parseOptionalString(searchParams.getAll(SharedApiQueryParamKeys.actorWorkspaceId)),
    search: parseOptionalString(searchParams.getAll(SharedApiQueryParamKeys.search)),
    pagination: Object.freeze({
      limit: parseOptionalNumber(searchParams.getAll(SharedApiQueryParamKeys.limit)),
      offset: parseOptionalNumber(searchParams.getAll(SharedApiQueryParamKeys.offset)),
    }),
    sorting: Object.freeze({
      sortBy: parseOptionalString(searchParams.getAll(SharedApiQueryParamKeys.sortBy)),
      sortDirection: parseOptionalString(searchParams.getAll(SharedApiQueryParamKeys.sortDirection)) as "asc" | "desc" | undefined,
    }),
    filters: Object.freeze({
      categories: searchParams.getAll("category") as AuditQueryCategories,
      outcomes: searchParams.getAll("outcome") as AuditQueryOutcomes,
      eventTypes: searchParams.getAll("eventType"),
      actions: searchParams.getAll("action"),
      actionPrefix: parseOptionalString(searchParams.getAll("actionPrefix")),
      actorIds: searchParams.getAll("actorId"),
      workspaceIds: searchParams.getAll("workspaceId"),
      resourceTypes: searchParams.getAll("resourceType"),
      resourceIds: searchParams.getAll("resourceId"),
      correlationIds: searchParams.getAll("correlationId"),
      requestIds: searchParams.getAll("requestId"),
      eventGroupIds: searchParams.getAll("eventGroupId"),
      rootEventIds: searchParams.getAll("rootEventId"),
      parentEventIds: searchParams.getAll("parentEventId"),
      workflowIds: searchParams.getAll("workflowId"),
      sessionRefs: searchParams.getAll("sessionRef"),
      runIds: searchParams.getAll("runId"),
      governanceActionIds: searchParams.getAll("governanceActionId"),
      hasProtectedData: parseOptionalBoolean(searchParams.getAll("hasProtectedData")),
      occurredAfter: parseOptionalString(searchParams.getAll("occurredAfter")),
      occurredBefore: parseOptionalString(searchParams.getAll("occurredBefore")),
      includeThinSafeOnly: parseOptionalBoolean(searchParams.getAll("includeThinSafeOnly")),
    }),
  });

  return parseAuditEventListQueryDto(payload);
}
