import { z } from "zod";
import {
  OfflineCacheFreshnessStates,
  OfflineExecutionClasses,
  OfflineConflictClasses,
  OfflineConflictSeverities,
  OfflineConnectivityStates,
  OfflineDraftSyncStatuses,
  OfflineLocalExecutionHistoryScopes,
  OfflineLocalExecutionOutcomes,
  OfflineLocalExecutionOutputClasses,
  OfflineLocalExecutionRegistrationStatuses,
  OfflineNodeOperationalModes,
  OfflinePendingOperationIntents,
  OfflinePendingOperationStatuses,
  OfflineReplayHttpMethods,
  OfflineReconciliationActions,
  OfflineWorkstationModes,
  OfflineSyncResourceClasses,
  OfflineSynchronizationContractVersions,
  OfflineSynchronizationStates,
} from "../../contracts/runtime/OfflineSynchronizationContracts";
import type {
  OfflineCachedResourceMetadataDto,
  OfflineConnectivitySurfaceStateDto,
  OfflineConflictIndicatorDto,
  OfflineDraftStateDto,
  OfflineLocalChangeRecordDto,
  OfflinePendingOperationEnvelopeDto,
  OfflineReconciliationOutcomeDto,
  OfflineSynchronizationStateSnapshotDto,
  OfflineSynchronizationStateReadResponseDto,
  OfflineSynchronizationStateWriteRequestDto,
  OfflineSynchronizationStatusDto,
  OfflineSyncQueueStateDto,
} from "../../dto/runtime/OfflineSynchronizationDtos";

export interface OfflineSynchronizationSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class OfflineSynchronizationSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<OfflineSynchronizationSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<OfflineSynchronizationSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "OfflineSynchronizationSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const RequiredStringSchema = z.string().trim().min(1, "Value is required.");
const TimestampSchema = z.string().trim().datetime({ offset: true });

const OfflineSyncResourceClassSchema = z.enum([
  OfflineSyncResourceClasses.workspaceCatalog,
  OfflineSyncResourceClasses.workflowDefinition,
  OfflineSyncResourceClasses.workflowDraft,
  OfflineSyncResourceClasses.runSubmissionIntent,
  OfflineSyncResourceClasses.localRuntimeSession,
  OfflineSyncResourceClasses.secretPlaintextMaterial,
]);

const OfflineCacheFreshnessStateSchema = z.enum([
  OfflineCacheFreshnessStates.fresh,
  OfflineCacheFreshnessStates.stale,
  OfflineCacheFreshnessStates.expired,
]);

const OfflineLocalChangeKindSchema = z.enum([
  "create",
  "update",
  "delete",
  "reorder",
  "metadata",
]);

const OfflinePendingOperationIntentSchema = z.enum([
  OfflinePendingOperationIntents.promoteLocalDraft,
  OfflinePendingOperationIntents.createOrUpdateAuthoritative,
  OfflinePendingOperationIntents.deleteAuthoritative,
]);

const OfflinePendingOperationStatusSchema = z.enum([
  OfflinePendingOperationStatuses.queuedPendingSync,
  OfflinePendingOperationStatuses.syncConflict,
  OfflinePendingOperationStatuses.syncApplied,
  OfflinePendingOperationStatuses.syncRejected,
]);

const OfflineDraftSyncStatusSchema = z.enum([
  OfflineDraftSyncStatuses.localOnly,
  OfflineDraftSyncStatuses.queuedPendingSync,
  OfflineDraftSyncStatuses.syncConflict,
  OfflineDraftSyncStatuses.syncRejected,
  OfflineDraftSyncStatuses.syncApplied,
]);

const OfflineReplayHttpMethodSchema = z.enum([
  OfflineReplayHttpMethods.post,
  OfflineReplayHttpMethods.put,
  OfflineReplayHttpMethods.patch,
  OfflineReplayHttpMethods.delete,
]);

const OfflineExecutionClassSchema = z.enum([
  OfflineExecutionClasses.localWorkflowPreview,
  OfflineExecutionClasses.localWorkflowValidation,
]);

const OfflineNodeOperationalModeSchema = z.enum([
  OfflineNodeOperationalModes.workstationClient,
  OfflineNodeOperationalModes.managedWorkstationClient,
  OfflineNodeOperationalModes.dedicatedExecutor,
  OfflineNodeOperationalModes.authoritativeControlPlane,
]);

const OfflineWorkstationModeSchema = z.enum([
  OfflineWorkstationModes.interactiveUserSession,
  OfflineWorkstationModes.managedBackgroundAgent,
  OfflineWorkstationModes.sharedKioskSession,
  OfflineWorkstationModes.headlessService,
]);

const OfflineLocalExecutionOutcomeSchema = z.enum([
  OfflineLocalExecutionOutcomes.succeeded,
  OfflineLocalExecutionOutcomes.failed,
  OfflineLocalExecutionOutcomes.cancelled,
]);

const OfflineLocalExecutionHistoryScopeSchema = z.enum([
  OfflineLocalExecutionHistoryScopes.explicitLocalActivity,
]);

const OfflineLocalExecutionOutputClassSchema = z.enum([
  OfflineLocalExecutionOutputClasses.logBundle,
  OfflineLocalExecutionOutputClasses.previewArtifact,
  OfflineLocalExecutionOutputClasses.metricsSnapshot,
]);

const OfflineLocalExecutionRegistrationStatusSchema = z.enum([
  OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration,
  OfflineLocalExecutionRegistrationStatuses.registrationConflict,
  OfflineLocalExecutionRegistrationStatuses.registrationRejected,
  OfflineLocalExecutionRegistrationStatuses.registrationApplied,
]);

const OfflineConflictSeveritySchema = z.enum([
  OfflineConflictSeverities.low,
  OfflineConflictSeverities.medium,
  OfflineConflictSeverities.high,
]);

const OfflineConflictClassSchema = z.enum([
  OfflineConflictClasses.staleBaseEdit,
  OfflineConflictClasses.deletedOrRevokedResource,
  OfflineConflictClasses.permissionChangedDuringDisconnection,
  OfflineConflictClasses.invalidatedRunSubmission,
  OfflineConflictClasses.resourceVersionMismatch,
  OfflineConflictClasses.authoritativeStateUnavailable,
]);

const OfflineReconciliationActionSchema = z.enum([
  OfflineReconciliationActions.applyToAuthoritative,
  OfflineReconciliationActions.conflictRequiresReview,
  OfflineReconciliationActions.rejectNotAllowed,
]);

const OfflineSynchronizationStateSchema = z.enum([
  OfflineSynchronizationStates.idle,
  OfflineSynchronizationStates.synchronizing,
  OfflineSynchronizationStates.blockedConflict,
  OfflineSynchronizationStates.failed,
]);

const OfflineConnectivityStateSchema = z.enum([
  OfflineConnectivityStates.connecting,
  OfflineConnectivityStates.connected,
  OfflineConnectivityStates.reconnecting,
  OfflineConnectivityStates.degraded,
  OfflineConnectivityStates.disconnected,
]);

const OfflineModeIntentSchema = z.enum([
  "none",
  "automatic",
  "deliberate",
]);

const OfflineTrustEnforcementSchema = z.enum([
  "required",
  "optional",
]);

export const OfflineCachedResourceMetadataDtoSchema: z.ZodType<OfflineCachedResourceMetadataDto> = z.object({
  resourceClass: OfflineSyncResourceClassSchema,
  resourceId: RequiredStringSchema,
  authoritativeRevision: RequiredStringSchema,
  cachedRevision: RequiredStringSchema,
  cachedAt: TimestampSchema,
  freshness: OfflineCacheFreshnessStateSchema,
  expiresAt: TimestampSchema.optional(),
  contentHash: RequiredStringSchema.optional(),
  sizeBytes: z.number().int().min(0).optional(),
}).strict();

export const OfflineLocalChangeRecordDtoSchema: z.ZodType<OfflineLocalChangeRecordDto> = z.object({
  changeId: RequiredStringSchema,
  draftId: RequiredStringSchema,
  resourceId: RequiredStringSchema,
  kind: OfflineLocalChangeKindSchema,
  changedAt: TimestampSchema,
  changedByActorUserIdentityId: RequiredStringSchema,
  path: RequiredStringSchema.optional(),
  summary: z.string().trim().min(1).max(512).optional(),
}).strict();

export const OfflineDraftStateDtoSchema: z.ZodType<OfflineDraftStateDto> = z.object({
  draftId: RequiredStringSchema,
  resourceClass: OfflineSyncResourceClassSchema,
  resourceId: RequiredStringSchema,
  baseAuthoritativeRevision: RequiredStringSchema,
  authoritativeSnapshotRevision: RequiredStringSchema,
  draftRevision: z.number().int().min(1),
  syncStatus: OfflineDraftSyncStatusSchema,
  queuedMutationId: RequiredStringSchema.optional(),
  dirty: z.boolean(),
  lastEditedAt: TimestampSchema,
  lastEditedByActorUserIdentityId: RequiredStringSchema,
  localChanges: z.array(OfflineLocalChangeRecordDtoSchema),
}).strict().superRefine((value, context) => {
  if (!value.dirty && value.localChanges.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["localChanges"],
      message: "Drafts marked clean cannot include localChanges entries.",
    });
  }
  if (value.syncStatus === OfflineDraftSyncStatuses.queuedPendingSync && !value.queuedMutationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["queuedMutationId"],
      message: "Queued draft sync status requires queuedMutationId.",
    });
  }
  if (value.syncStatus === OfflineDraftSyncStatuses.localOnly && value.queuedMutationId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["queuedMutationId"],
      message: "Local-only draft status cannot retain queuedMutationId.",
    });
  }
});

const OfflinePendingOperationReplayDescriptorDtoSchema = z.object({
  method: OfflineReplayHttpMethodSchema,
  path: RequiredStringSchema.refine((value) => value.startsWith("/"), {
    message: "Replay path must be rooted and start with '/'.",
  }),
  idempotencyKey: RequiredStringSchema,
  payload: z.record(z.string(), z.unknown()),
  payloadContentType: RequiredStringSchema.optional(),
}).strict();

const OfflineLocalExecutionOutputDtoSchema = z.object({
  outputId: RequiredStringSchema,
  outputClass: OfflineLocalExecutionOutputClassSchema,
  contentDigest: RequiredStringSchema,
  sizeBytes: z.number().int().min(0).optional(),
}).strict();

const OfflineLocalExecutionRecordDtoSchema = z.object({
  executionId: RequiredStringSchema,
  executionClass: OfflineExecutionClassSchema,
  resourceClass: OfflineSyncResourceClassSchema,
  resourceId: RequiredStringSchema,
  startedAt: TimestampSchema,
  completedAt: TimestampSchema,
  executedByActorUserIdentityId: RequiredStringSchema,
  nodeOperationalMode: OfflineNodeOperationalModeSchema,
  workstationMode: OfflineWorkstationModeSchema,
  outcome: OfflineLocalExecutionOutcomeSchema,
  inputDigest: RequiredStringSchema,
  outputs: z.array(OfflineLocalExecutionOutputDtoSchema),
  historyScope: OfflineLocalExecutionHistoryScopeSchema,
}).strict().superRefine((value, context) => {
  if (new Date(value.completedAt).getTime() < new Date(value.startedAt).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["completedAt"],
      message: "Local execution completedAt cannot be earlier than startedAt.",
    });
  }
});

const OfflineLocalExecutionRegistrationEnvelopeDtoSchema = z.object({
  registrationId: RequiredStringSchema,
  execution: OfflineLocalExecutionRecordDtoSchema,
  queuedAt: TimestampSchema,
  userVisibleRegistrationStatus: OfflineLocalExecutionRegistrationStatusSchema,
  divergenceDisclosureToken: RequiredStringSchema,
  replayDescriptor: OfflinePendingOperationReplayDescriptorDtoSchema,
  retryCount: z.number().int().min(0),
  lastAttemptedAt: TimestampSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.userVisibleRegistrationStatus === OfflineLocalExecutionRegistrationStatuses.registrationApplied) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userVisibleRegistrationStatus"],
      message: "Queue local execution registrations cannot retain registration-applied entries; move them to outcomes.",
    });
  }
  if (value.execution.historyScope !== OfflineLocalExecutionHistoryScopes.explicitLocalActivity) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["execution", "historyScope"],
      message: "Local execution registrations must preserve explicit-local-activity history scope.",
    });
  }
});

export const OfflinePendingOperationEnvelopeDtoSchema: z.ZodType<OfflinePendingOperationEnvelopeDto> = z.object({
  operationId: RequiredStringSchema,
  targetResourceClass: OfflineSyncResourceClassSchema,
  targetResourceId: RequiredStringSchema,
  intent: OfflinePendingOperationIntentSchema,
  baseAuthoritativeRevision: RequiredStringSchema,
  localMutationRevision: z.number().int().min(1),
  queuedAt: TimestampSchema,
  userVisibleSyncStatus: OfflinePendingOperationStatusSchema,
  divergenceDisclosureToken: RequiredStringSchema,
  replayDescriptor: OfflinePendingOperationReplayDescriptorDtoSchema,
  retryCount: z.number().int().min(0),
  lastAttemptedAt: TimestampSchema.optional(),
}).strict();

const OfflinePendingRunSubmissionDtoSchema = z.object({
  submissionId: RequiredStringSchema,
  operationId: RequiredStringSchema,
  workflowDefinitionId: RequiredStringSchema,
  inputDigest: RequiredStringSchema,
  requestedAt: TimestampSchema,
  requestedByActorUserIdentityId: RequiredStringSchema,
}).strict();

export const OfflineConflictIndicatorDtoSchema: z.ZodType<OfflineConflictIndicatorDto> = z.object({
  operationId: RequiredStringSchema,
  resourceClass: OfflineSyncResourceClassSchema,
  resourceId: RequiredStringSchema,
  severity: OfflineConflictSeveritySchema,
  conflictClass: OfflineConflictClassSchema,
  conflictCode: RequiredStringSchema,
  summary: z.string().trim().min(1).max(1024),
  authoritativeRevision: RequiredStringSchema.optional(),
  localMutationRevision: z.number().int().min(1).optional(),
  detectedAt: TimestampSchema,
  requiresUserAttention: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!value.requiresUserAttention && value.severity === OfflineConflictSeverities.high) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requiresUserAttention"],
      message: "High-severity conflicts must require user attention.",
    });
  }
});

export const OfflineReconciliationOutcomeDtoSchema: z.ZodType<OfflineReconciliationOutcomeDto> = z.object({
  operationId: RequiredStringSchema,
  action: OfflineReconciliationActionSchema,
  requiresUserAttention: z.boolean(),
  requiresAdminAttention: z.boolean(),
  preserveLocalDraftAsUnsynced: z.boolean(),
  decisionRule: RequiredStringSchema,
  reason: z.string().trim().min(1).max(1024),
  resolvedAt: TimestampSchema,
  authoritativeRevisionAfter: RequiredStringSchema.optional(),
  conflicts: z.array(OfflineConflictIndicatorDtoSchema).optional(),
}).strict().superRefine((value, context) => {
  if (value.action === OfflineReconciliationActions.conflictRequiresReview) {
    if (!value.requiresUserAttention) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiresUserAttention"],
        message: "Conflict outcomes must require user attention.",
      });
    }
    if (!value.conflicts || value.conflicts.length < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conflicts"],
        message: "Conflict outcomes must include at least one conflict indicator.",
      });
    }
  }
  if (value.action === OfflineReconciliationActions.applyToAuthoritative && value.requiresAdminAttention) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["requiresAdminAttention"],
      message: "Applied outcomes cannot require admin attention.",
    });
  }
});

export const OfflineSyncQueueStateDtoSchema: z.ZodType<OfflineSyncQueueStateDto> = z.object({
  queueId: RequiredStringSchema,
  operations: z.array(OfflinePendingOperationEnvelopeDtoSchema),
  localExecutionRegistrations: z.array(OfflineLocalExecutionRegistrationEnvelopeDtoSchema),
  pendingRunSubmissions: z.array(OfflinePendingRunSubmissionDtoSchema),
  outcomes: z.array(OfflineReconciliationOutcomeDtoSchema),
  updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  const operationIds = new Set<string>();
  for (const operation of value.operations) {
    if (operationIds.has(operation.operationId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operations"],
        message: "Queue operations must use unique operationId values.",
      });
      break;
    }
    operationIds.add(operation.operationId);

    if (operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.syncApplied) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["operations"],
        message: "Queue operations cannot retain sync-applied entries; move them to outcomes.",
      });
      break;
    }
  }

  const localExecutionRegistrationIds = new Set<string>();
  for (const registration of value.localExecutionRegistrations) {
    if (localExecutionRegistrationIds.has(registration.registrationId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["localExecutionRegistrations"],
        message: "Local execution registrations must use unique registrationId values.",
      });
      break;
    }
    localExecutionRegistrationIds.add(registration.registrationId);
  }

  for (const pendingRunSubmission of value.pendingRunSubmissions) {
    if (!operationIds.has(pendingRunSubmission.operationId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pendingRunSubmissions"],
        message: "Pending run submissions must reference an operation present in queue.operations.",
      });
      break;
    }
  }
});

export const OfflineSynchronizationStatusDtoSchema: z.ZodType<OfflineSynchronizationStatusDto> = z.object({
  state: OfflineSynchronizationStateSchema,
  pendingOperationCount: z.number().int().min(0),
  conflictCount: z.number().int().min(0),
  rejectedCount: z.number().int().min(0),
  lastSynchronizedAt: TimestampSchema.optional(),
  lastAttemptedAt: TimestampSchema.optional(),
  reasonCode: RequiredStringSchema.optional(),
}).strict();

export const OfflineConnectivitySurfaceStateDtoSchema: z.ZodType<OfflineConnectivitySurfaceStateDto> = z.object({
  state: OfflineConnectivityStateSchema,
  stale: z.boolean(),
  localModeActive: z.boolean(),
  detail: z.string().trim().min(1).max(512).optional(),
  reasonCode: z.string().trim().min(1).max(128).optional(),
  offlineModeIntent: OfflineModeIntentSchema.optional(),
  transportReachable: z.boolean().optional(),
  trustedSessionAvailable: z.boolean().optional(),
  trustPrerequisitesSatisfied: z.boolean().optional(),
  trustEnforcement: OfflineTrustEnforcementSchema.optional(),
  lastChangedAt: TimestampSchema,
  canQueueOperations: z.boolean(),
  canResynchronize: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.state === OfflineConnectivityStates.disconnected && value.canResynchronize) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["canResynchronize"],
      message: "Disconnected connectivity state cannot advertise canResynchronize=true.",
    });
  }
  if (value.offlineModeIntent === "deliberate" && value.state !== OfflineConnectivityStates.disconnected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["offlineModeIntent"],
      message: "Deliberate offline mode requires disconnected connectivity state.",
    });
  }
  if (value.transportReachable === false && value.state === OfflineConnectivityStates.connected) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["transportReachable"],
      message: "Connected connectivity state requires transportReachable=true when provided.",
    });
  }
});

export const OfflineSynchronizationStateSnapshotDtoSchema: z.ZodType<OfflineSynchronizationStateSnapshotDto> = z.object({
  contractVersion: z.literal(OfflineSynchronizationContractVersions.v1),
  workspaceId: RequiredStringSchema,
  cachedResources: z.array(OfflineCachedResourceMetadataDtoSchema),
  drafts: z.array(OfflineDraftStateDtoSchema),
  queue: OfflineSyncQueueStateDtoSchema,
  status: OfflineSynchronizationStatusDtoSchema,
  connectivity: OfflineConnectivitySurfaceStateDtoSchema,
}).strict().superRefine((value, context) => {
  const pendingOperationCount = value.queue.operations
    .filter((operation) => operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.queuedPendingSync)
    .length;
  const pendingRegistrationCount = value.queue.localExecutionRegistrations
    .filter((registration) => (
      registration.userVisibleRegistrationStatus
      === OfflineLocalExecutionRegistrationStatuses.queuedPendingRegistration
    ))
    .length;
  const conflictCount = value.queue.operations
    .filter((operation) => operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.syncConflict)
    .length;
  const registrationConflictCount = value.queue.localExecutionRegistrations
    .filter((registration) => (
      registration.userVisibleRegistrationStatus
      === OfflineLocalExecutionRegistrationStatuses.registrationConflict
    ))
    .length;
  const rejectedCount = value.queue.operations
    .filter((operation) => operation.userVisibleSyncStatus === OfflinePendingOperationStatuses.syncRejected)
    .length;
  const registrationRejectedCount = value.queue.localExecutionRegistrations
    .filter((registration) => (
      registration.userVisibleRegistrationStatus
      === OfflineLocalExecutionRegistrationStatuses.registrationRejected
    ))
    .length;

  const pendingTotalCount = pendingOperationCount + pendingRegistrationCount;
  const conflictTotalCount = conflictCount + registrationConflictCount;
  const rejectedTotalCount = rejectedCount + registrationRejectedCount;

  if (value.status.pendingOperationCount !== pendingTotalCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status", "pendingOperationCount"],
      message: "status.pendingOperationCount must match queued operation status counts.",
    });
  }
  if (value.status.conflictCount !== conflictTotalCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status", "conflictCount"],
      message: "status.conflictCount must match queued operation status counts.",
    });
  }
  if (value.status.rejectedCount !== rejectedTotalCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status", "rejectedCount"],
      message: "status.rejectedCount must match queued operation status counts.",
    });
  }
  if (
    value.status.state === OfflineSynchronizationStates.blockedConflict
    && value.status.conflictCount < 1
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["status", "state"],
      message: "blocked-conflict requires conflictCount > 0.",
    });
  }
});

export const OfflineSynchronizationStateReadResponseDtoSchema: z.ZodType<OfflineSynchronizationStateReadResponseDto> =
  z.object({
    state: OfflineSynchronizationStateSnapshotDtoSchema,
  }).strict();

export const OfflineSynchronizationStateWriteRequestDtoSchema: z.ZodType<OfflineSynchronizationStateWriteRequestDto> =
  z.object({
    workspaceId: RequiredStringSchema,
    state: OfflineSynchronizationStateSnapshotDtoSchema,
    persistedAt: TimestampSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (value.workspaceId !== value.state.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["state", "workspaceId"],
        message: "state.workspaceId must match workspaceId.",
      });
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

function toValidationError(schemaName: string, error: z.ZodError): OfflineSynchronizationSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new OfflineSynchronizationSchemaValidationError(schemaName, issues);
}

function parseOfflineSynchronizationSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseOfflineSynchronizationStateSnapshotDto(payload: unknown): OfflineSynchronizationStateSnapshotDto {
  return parseOfflineSynchronizationSchema(
    "OfflineSynchronizationStateSnapshotDto",
    OfflineSynchronizationStateSnapshotDtoSchema,
    payload,
  );
}

export function parseOfflineSynchronizationStateReadResponseDto(
  payload: unknown,
): OfflineSynchronizationStateReadResponseDto {
  return parseOfflineSynchronizationSchema(
    "OfflineSynchronizationStateReadResponseDto",
    OfflineSynchronizationStateReadResponseDtoSchema,
    payload,
  );
}

export function parseOfflineSynchronizationStateWriteRequestDto(
  payload: unknown,
): OfflineSynchronizationStateWriteRequestDto {
  return parseOfflineSynchronizationSchema(
    "OfflineSynchronizationStateWriteRequestDto",
    OfflineSynchronizationStateWriteRequestDtoSchema,
    payload,
  );
}

export function parseOfflineConnectivitySurfaceStateDto(payload: unknown): OfflineConnectivitySurfaceStateDto {
  return parseOfflineSynchronizationSchema(
    "OfflineConnectivitySurfaceStateDto",
    OfflineConnectivitySurfaceStateDtoSchema,
    payload,
  );
}
