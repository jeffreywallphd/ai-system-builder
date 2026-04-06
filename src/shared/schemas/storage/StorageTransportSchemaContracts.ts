import { z } from "zod";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageEncryptionKeyScopes,
  StorageEncryptionModes,
  StorageLifecycleStates,
  StorageManagedActions,
  StoragePolicyRestrictedCapabilities,
  StorageReplicationModes,
  StorageRetentionExpiryActions,
} from "../../../domain/storage/StorageDomain";
import {
  StorageAccessPermissionEffects,
  StorageAccessSummarySources,
  StorageSensitiveRedactionReasons,
  StorageSyncDeploymentAvailabilities,
  StorageSyncStatuses,
  StorageTransportContractVersions,
  StorageTransportFieldLimits,
  StorageTransportPatterns,
} from "../../contracts/storage/StorageTransportContracts";
import type {
  CreateStorageInstanceRequestDto,
  CreateStorageInstanceResponseDto,
  GetStorageInstanceDetailRequestDto,
  GetStorageInstanceDetailResponseDto,
  ListStorageInstancesRequestDto,
  ListStorageInstancesResponseDto,
  UpdateStorageInstanceRequestDto,
  UpdateStorageInstanceResponseDto,
} from "../../dto/storage/StorageTransportDtos";

export interface StorageTransportSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class StorageTransportSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<StorageTransportSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<StorageTransportSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "StorageTransportSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const MetadataLabelUnsafeKeyPattern = /(secret|password|token|credential|private|key|pem|path)/i;

const IdentifierSchema = z.string().trim()
  .min(1, "Identifier is required.")
  .max(
    StorageTransportFieldLimits.identifierMaxLength,
    `Identifier must be ${StorageTransportFieldLimits.identifierMaxLength} characters or fewer.`,
  )
  .regex(StorageTransportPatterns.identifier, "Identifier format is invalid.");

const StorageInstanceIdSchema = z.string().trim()
  .min(1, "storageInstanceId is required.")
  .max(
    StorageTransportFieldLimits.identifierMaxLength,
    `storageInstanceId must be ${StorageTransportFieldLimits.identifierMaxLength} characters or fewer.`,
  )
  .regex(StorageTransportPatterns.storageInstanceId, "storageInstanceId format is invalid.");

const TimestampSchema = z.string().trim().datetime({ offset: true });

const DisplayNameSchema = z.string().trim()
  .min(3, "display.displayName must be at least 3 characters.")
  .max(
    StorageTransportFieldLimits.displayNameMaxLength,
    `display.displayName must be ${StorageTransportFieldLimits.displayNameMaxLength} characters or fewer.`,
  );

const DescriptionSchema = z.string().trim()
  .min(1, "display.description cannot be empty.")
  .max(
    StorageTransportFieldLimits.descriptionMaxLength,
    `display.description must be ${StorageTransportFieldLimits.descriptionMaxLength} characters or fewer.`,
  );

const TagSchema = z.string().trim().toLowerCase()
  .min(1, "display.tags cannot contain empty values.")
  .max(
    StorageTransportFieldLimits.tagMaxLength,
    `display.tags entries must be ${StorageTransportFieldLimits.tagMaxLength} characters or fewer.`,
  );

const MetadataLabelKeySchema = z.string().trim().toLowerCase()
  .min(1, "labels keys cannot be empty.")
  .max(
    StorageTransportFieldLimits.labelKeyMaxLength,
    `labels keys must be ${StorageTransportFieldLimits.labelKeyMaxLength} characters or fewer.`,
  )
  .regex(StorageTransportPatterns.metadataLabelKey, "labels keys use lowercase letters, numbers, '.', '_' or '-'.")
  .refine((value) => !MetadataLabelUnsafeKeyPattern.test(value), {
    message: "labels keys must be redaction-safe.",
  });

const MetadataLabelValueSchema = z.string().trim()
  .min(1, "labels values cannot be empty.")
  .max(
    StorageTransportFieldLimits.labelValueMaxLength,
    `labels values must be ${StorageTransportFieldLimits.labelValueMaxLength} characters or fewer.`,
  );

const DisplayMetadataSchema = z.object({
  displayName: DisplayNameSchema,
  description: DescriptionSchema.optional(),
  tags: z.array(TagSchema).max(
    StorageTransportFieldLimits.maxTags,
    `display.tags can include up to ${StorageTransportFieldLimits.maxTags} values.`,
  ).optional(),
  labels: z.record(MetadataLabelKeySchema, MetadataLabelValueSchema).optional(),
  iconName: IdentifierSchema.optional(),
  colorToken: IdentifierSchema.optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict();

const StorageAccessModeSchema = z.enum([
  StorageAccessModes.readWrite,
  StorageAccessModes.readOnly,
  StorageAccessModes.appendOnly,
]);

const StorageAccessScopeSchema = z.enum([
  StorageAccessScopes.workspace,
  StorageAccessScopes.workspaceMembers,
  StorageAccessScopes.platformManaged,
]);

const StorageManagedActionSchema = z.enum([
  StorageManagedActions.view,
  StorageManagedActions.updateMetadata,
  StorageManagedActions.provision,
  StorageManagedActions.activate,
  StorageManagedActions.deactivate,
  StorageManagedActions.useForAssets,
]);

const StoragePolicyRestrictedCapabilitySchema = z.enum([
  StoragePolicyRestrictedCapabilities.mutableWrites,
  StoragePolicyRestrictedCapabilities.crossWorkspaceReads,
  StoragePolicyRestrictedCapabilities.previewDecryption,
  StoragePolicyRestrictedCapabilities.workerDecryption,
]);

const StorageAccessPermissionEffectSchema = z.enum([
  StorageAccessPermissionEffects.allowed,
  StorageAccessPermissionEffects.denied,
  StorageAccessPermissionEffects.restricted,
  StorageAccessPermissionEffects.unknown,
]);

const StorageAccessSummarySourceSchema = z.enum([
  StorageAccessSummarySources.authorizationPolicy,
  StorageAccessSummarySources.ownershipDefault,
  StorageAccessSummarySources.mixed,
  StorageAccessSummarySources.unknown,
]);

const StorageBackendTypeSchema = z.enum([
  StorageBackendTypes.managedFilesystem,
  StorageBackendTypes.objectStorage,
  StorageBackendTypes.networkShare,
]);

const StorageLifecycleStateSchema = z.enum([
  StorageLifecycleStates.provisioning,
  StorageLifecycleStates.active,
  StorageLifecycleStates.suspended,
  StorageLifecycleStates.degraded,
  StorageLifecycleStates.archived,
  StorageLifecycleStates.deleting,
  StorageLifecycleStates.deleted,
  StorageLifecycleStates.failed,
]);

const StorageReplicationModeSchema = z.enum([
  StorageReplicationModes.none,
  StorageReplicationModes.asyncMirror,
  StorageReplicationModes.syncMirror,
]);

const StorageSyncStatusSchema = z.enum([
  StorageSyncStatuses.pending,
  StorageSyncStatuses.running,
  StorageSyncStatuses.healthy,
  StorageSyncStatuses.degraded,
  StorageSyncStatuses.failed,
  StorageSyncStatuses.disabled,
]);

const StorageSyncDeploymentAvailabilitySchema = z.enum([
  StorageSyncDeploymentAvailabilities.active,
  StorageSyncDeploymentAvailabilities.configuredInactive,
  StorageSyncDeploymentAvailabilities.unavailable,
]);

const StorageEncryptionModeSchema = z.enum([
  StorageEncryptionModes.none,
  StorageEncryptionModes.platformManaged,
  StorageEncryptionModes.customerManaged,
]);

const StorageEncryptionKeyScopeSchema = z.enum([
  StorageEncryptionKeyScopes.workspace,
  StorageEncryptionKeyScopes.storageInstance,
  StorageEncryptionKeyScopes.platform,
]);

const StorageRetentionExpiryActionSchema = z.enum([
  StorageRetentionExpiryActions.none,
  StorageRetentionExpiryActions.archive,
  StorageRetentionExpiryActions.delete,
]);

const StorageReplicationPolicySchema = z.object({
  mode: StorageReplicationModeSchema,
  replicaStorageInstanceId: StorageInstanceIdSchema.optional(),
  syncIntervalSeconds: z.number().int().min(10).optional(),
}).strict().superRefine((value, context) => {
  if (value.mode === StorageReplicationModes.none) {
    if (value.replicaStorageInstanceId || value.syncIntervalSeconds !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mode"],
        message: "replication.mode='none' cannot include replicaStorageInstanceId or syncIntervalSeconds.",
      });
    }
    return;
  }

  if (!value.replicaStorageInstanceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["replicaStorageInstanceId"],
      message: `replication mode '${value.mode}' requires replicaStorageInstanceId.`,
    });
  }

  if (value.mode === StorageReplicationModes.asyncMirror && value.syncIntervalSeconds === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["syncIntervalSeconds"],
      message: "replication mode 'async-mirror' requires syncIntervalSeconds.",
    });
  }

  if (value.mode === StorageReplicationModes.syncMirror && value.syncIntervalSeconds !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["syncIntervalSeconds"],
      message: "replication mode 'sync-mirror' cannot include syncIntervalSeconds.",
    });
  }
});

const StoragePolicyInputSchema = z.object({
  policyId: IdentifierSchema,
  maxObjectBytes: z.number().int().positive().optional(),
  retentionDays: z.number().int().positive().optional(),
  immutableWrites: z.boolean().optional(),
  allowCrossWorkspaceReads: z.boolean().optional(),
  labels: z.record(MetadataLabelKeySchema, MetadataLabelValueSchema).optional(),
  encryptionMode: StorageEncryptionModeSchema.default(StorageEncryptionModes.platformManaged),
  contentEncryptionRequired: z.boolean().default(true),
  keyScope: StorageEncryptionKeyScopeSchema.default(StorageEncryptionKeyScopes.workspace),
  allowPreviewDecryption: z.boolean().default(false),
  allowWorkerDecryption: z.boolean().default(false),
  retentionExpiryAction: StorageRetentionExpiryActionSchema.default(StorageRetentionExpiryActions.none),
  purgeGracePeriodDays: z.number().int().positive().optional(),
  encryptionProfileId: IdentifierSchema,
  encryptionKeyReferenceId: IdentifierSchema.optional(),
  envelopeRequired: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.encryptionMode === StorageEncryptionModes.none) {
    if (value.contentEncryptionRequired) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentEncryptionRequired"],
        message: "encryptionMode='none' cannot require content encryption.",
      });
    }
    if (value.envelopeRequired) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envelopeRequired"],
        message: "encryptionMode='none' cannot require envelope encryption.",
      });
    }
    if (value.encryptionKeyReferenceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["encryptionKeyReferenceId"],
        message: "encryptionMode='none' cannot define encryptionKeyReferenceId.",
      });
    }
    if (value.allowPreviewDecryption || value.allowWorkerDecryption) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowPreviewDecryption"],
        message: "encryptionMode='none' cannot allow preview or worker decryption.",
      });
    }
  } else if (!value.contentEncryptionRequired) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contentEncryptionRequired"],
      message: "Managed encryption modes require contentEncryptionRequired=true.",
    });
  }

  if (value.encryptionMode === StorageEncryptionModes.customerManaged && !value.encryptionKeyReferenceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["encryptionKeyReferenceId"],
      message: "customer-managed encryption requires encryptionKeyReferenceId.",
    });
  }

  if (value.encryptionMode === StorageEncryptionModes.platformManaged && value.encryptionKeyReferenceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["encryptionKeyReferenceId"],
      message: "platform-managed encryption cannot include encryptionKeyReferenceId.",
    });
  }

  if (
    value.keyScope === StorageEncryptionKeyScopes.platform
    && value.encryptionMode === StorageEncryptionModes.customerManaged
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["keyScope"],
      message: "customer-managed encryption cannot use keyScope='platform'.",
    });
  }

  if (value.retentionExpiryAction !== StorageRetentionExpiryActions.none && value.retentionDays === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["retentionExpiryAction"],
      message: "retentionExpiryAction requires retentionDays.",
    });
  }

  if (value.purgeGracePeriodDays !== undefined && value.retentionExpiryAction !== StorageRetentionExpiryActions.delete) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["purgeGracePeriodDays"],
      message: "purgeGracePeriodDays is valid only when retentionExpiryAction='delete'.",
    });
  }
});

const StoragePolicyPartialUpdateSchema = z.object({
  maxObjectBytes: z.number().int().positive().optional(),
  retentionDays: z.number().int().positive().optional(),
  immutableWrites: z.boolean().optional(),
  allowCrossWorkspaceReads: z.boolean().optional(),
  labels: z.record(MetadataLabelKeySchema, MetadataLabelValueSchema).optional(),
  encryptionMode: StorageEncryptionModeSchema.optional(),
  contentEncryptionRequired: z.boolean().optional(),
  keyScope: StorageEncryptionKeyScopeSchema.optional(),
  allowPreviewDecryption: z.boolean().optional(),
  allowWorkerDecryption: z.boolean().optional(),
  retentionExpiryAction: StorageRetentionExpiryActionSchema.optional(),
  purgeGracePeriodDays: z.number().int().positive().optional(),
  encryptionProfileId: IdentifierSchema.optional(),
  encryptionKeyReferenceId: IdentifierSchema.optional(),
  envelopeRequired: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.encryptionMode === StorageEncryptionModes.none && value.contentEncryptionRequired === true) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contentEncryptionRequired"],
      message: "encryptionMode='none' cannot require content encryption.",
    });
  }

  if (
    value.encryptionMode === StorageEncryptionModes.none
    && (value.allowPreviewDecryption === true || value.allowWorkerDecryption === true)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowPreviewDecryption"],
      message: "encryptionMode='none' cannot allow preview or worker decryption.",
    });
  }

  if (
    value.encryptionMode === StorageEncryptionModes.customerManaged
    && value.encryptionKeyReferenceId !== undefined
    && value.encryptionKeyReferenceId.trim().length < 1
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["encryptionKeyReferenceId"],
      message: "customer-managed encryption requires a non-empty encryptionKeyReferenceId when provided.",
    });
  }

  if (
    value.keyScope === StorageEncryptionKeyScopes.platform
    && value.encryptionMode === StorageEncryptionModes.customerManaged
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["keyScope"],
      message: "customer-managed encryption cannot use keyScope='platform'.",
    });
  }

  if (
    value.purgeGracePeriodDays !== undefined
    && value.retentionExpiryAction !== undefined
    && value.retentionExpiryAction !== StorageRetentionExpiryActions.delete
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["purgeGracePeriodDays"],
      message: "purgeGracePeriodDays is valid only when retentionExpiryAction='delete'.",
    });
  }
});

const StorageAccessEffectivePermissionSchema = z.object({
  action: StorageManagedActionSchema,
  effect: StorageAccessPermissionEffectSchema,
  reasonCode: IdentifierSchema.optional(),
  message: z.string().trim().min(1).max(512).optional(),
}).strict();

const StoragePolicyRestrictedCapabilitySummarySchema = z.object({
  capability: StoragePolicyRestrictedCapabilitySchema,
  restricted: z.boolean(),
  reasonCode: IdentifierSchema.optional(),
}).strict();

const StorageAccessSummarySchema = z.object({
  workspaceId: IdentifierSchema,
  ownerUserIdentityId: IdentifierSchema,
  actorUserIdentityId: IdentifierSchema.optional(),
  mode: StorageAccessModeSchema,
  scope: StorageAccessScopeSchema,
  isOwner: z.boolean(),
  source: StorageAccessSummarySourceSchema,
  effectivePermissions: z.array(StorageAccessEffectivePermissionSchema),
  allowedActions: z.array(StorageManagedActionSchema),
  policyRestrictedCapabilities: z.array(StoragePolicyRestrictedCapabilitySummarySchema),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict().superRefine((value, context) => {
  const allowedFromPermissions = new Set(
    value.effectivePermissions
      .filter((permission) => permission.effect === StorageAccessPermissionEffects.allowed)
      .map((permission) => permission.action),
  );

  for (const action of value.allowedActions) {
    if (!allowedFromPermissions.has(action)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowedActions"],
        message: `allowedActions includes '${action}' without an allowed effectivePermissions entry.`,
      });
    }
  }
});

const StoragePolicyMetadataSchema = z.object({
  policyId: IdentifierSchema,
  maxObjectBytes: z.number().int().positive().optional(),
  retentionDays: z.number().int().positive().optional(),
  immutableWrites: z.boolean(),
  allowCrossWorkspaceReads: z.boolean(),
  labels: z.record(MetadataLabelKeySchema, MetadataLabelValueSchema),
  encryptionMode: StorageEncryptionModeSchema,
  contentEncryptionRequired: z.boolean(),
  keyScope: StorageEncryptionKeyScopeSchema,
  allowPreviewDecryption: z.boolean(),
  allowWorkerDecryption: z.boolean(),
  retentionExpiryAction: StorageRetentionExpiryActionSchema,
  purgeGracePeriodDays: z.number().int().positive().optional(),
  encryptionProfileId: IdentifierSchema,
  envelopeRequired: z.boolean(),
  hasEncryptionKeyReference: z.boolean(),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict().superRefine((value, context) => {
  if (value.encryptionMode === StorageEncryptionModes.none) {
    if (value.contentEncryptionRequired) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentEncryptionRequired"],
        message: "encryptionMode='none' cannot require content encryption.",
      });
    }
    if (value.envelopeRequired) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["envelopeRequired"],
        message: "encryptionMode='none' cannot require envelope encryption.",
      });
    }
    if (value.hasEncryptionKeyReference) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hasEncryptionKeyReference"],
        message: "encryptionMode='none' cannot include encryption key references.",
      });
    }
    if (value.allowPreviewDecryption || value.allowWorkerDecryption) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowPreviewDecryption"],
        message: "encryptionMode='none' cannot allow preview or worker decryption.",
      });
    }
  } else if (!value.contentEncryptionRequired) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["contentEncryptionRequired"],
      message: "Managed encryption modes require contentEncryptionRequired=true.",
    });
  }

  if (value.encryptionMode === StorageEncryptionModes.customerManaged && !value.hasEncryptionKeyReference) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hasEncryptionKeyReference"],
      message: "customer-managed encryption requires hasEncryptionKeyReference=true.",
    });
  }

  if (value.encryptionMode === StorageEncryptionModes.platformManaged && value.hasEncryptionKeyReference) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["hasEncryptionKeyReference"],
      message: "platform-managed encryption cannot include key references.",
    });
  }

  if (
    value.keyScope === StorageEncryptionKeyScopes.platform
    && value.encryptionMode === StorageEncryptionModes.customerManaged
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["keyScope"],
      message: "customer-managed encryption cannot use keyScope='platform'.",
    });
  }

  if (value.retentionExpiryAction !== StorageRetentionExpiryActions.none && value.retentionDays === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["retentionExpiryAction"],
      message: "retentionExpiryAction requires retentionDays.",
    });
  }

  if (value.purgeGracePeriodDays !== undefined && value.retentionExpiryAction !== StorageRetentionExpiryActions.delete) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["purgeGracePeriodDays"],
      message: "purgeGracePeriodDays is valid only when retentionExpiryAction='delete'.",
    });
  }
});

const StorageLifecycleMetadataSchema = z.object({
  state: StorageLifecycleStateSchema,
  createdAt: TimestampSchema,
  lastModifiedAt: TimestampSchema,
  lastCorrelationId: IdentifierSchema.optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict();

const StorageReplicationStatusSchema = StorageReplicationPolicySchema.extend({
  lastSyncAt: TimestampSchema.optional(),
  lastSyncStatus: StorageSyncStatusSchema,
  syncLagSeconds: z.number().int().min(0).optional(),
  synchronization: z.object({
    syncCapable: z.boolean(),
    supportsReplicationSyncOperation: z.boolean(),
    deploymentAvailability: StorageSyncDeploymentAvailabilitySchema,
    reasonCode: IdentifierSchema.optional(),
    evaluatedAt: TimestampSchema.optional(),
  }).strict().superRefine((value, context) => {
    if (
      value.deploymentAvailability === StorageSyncDeploymentAvailabilities.unavailable
      && value.syncCapable
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["syncCapable"],
        message: "syncCapable must be false when deploymentAvailability='unavailable'.",
      });
    }

    if (!value.syncCapable && value.supportsReplicationSyncOperation) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["supportsReplicationSyncOperation"],
        message: "supportsReplicationSyncOperation cannot be true when syncCapable=false.",
      });
    }
  }).optional(),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict();

const StorageSensitiveRedactionEntrySchema = z.object({
  field: IdentifierSchema,
  reason: z.enum([
    StorageSensitiveRedactionReasons.securitySensitive,
    StorageSensitiveRedactionReasons.infrastructureInternal,
  ]),
  strategy: z.literal("omitted"),
}).strict();

const StorageSensitiveRedactionSummarySchema = z.object({
  contractVersion: z.literal(StorageTransportContractVersions.v1),
  redactedFields: z.array(StorageSensitiveRedactionEntrySchema).min(1),
  extensions: z.record(z.string(), z.unknown()).optional(),
}).strict();

export const StorageInstanceSummaryDtoSchema = z.object({
  storageInstanceId: StorageInstanceIdSchema,
  workspaceId: IdentifierSchema,
  backendType: StorageBackendTypeSchema,
  display: DisplayMetadataSchema,
  lifecycle: StorageLifecycleMetadataSchema,
}).strict();

export const StorageInstanceDetailDtoSchema = StorageInstanceSummaryDtoSchema.extend({
  ownerUserIdentityId: IdentifierSchema,
  access: StorageAccessSummarySchema,
  policy: StoragePolicyMetadataSchema,
  replication: StorageReplicationStatusSchema,
  sensitiveRedaction: StorageSensitiveRedactionSummarySchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.lifecycle.state === StorageLifecycleStates.deleted && value.replication.mode !== StorageReplicationModes.none) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["replication", "mode"],
      message: "Deleted storage detail payloads require replication.mode='none'.",
    });
  }

  if (value.ownerUserIdentityId !== value.access.ownerUserIdentityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["access", "ownerUserIdentityId"],
      message: "access.ownerUserIdentityId must match ownerUserIdentityId.",
    });
  }

  if (value.workspaceId !== value.access.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["access", "workspaceId"],
      message: "access.workspaceId must match workspaceId.",
    });
  }

  if (value.access.mode === StorageAccessModes.readOnly && value.access.allowedActions.includes(StorageManagedActions.updateMetadata)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["access", "allowedActions"],
      message: "read-only access mode cannot include update-metadata in allowedActions.",
    });
  }
});

export const CreateStorageInstanceRequestDtoSchema: z.ZodType<CreateStorageInstanceRequestDto> = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  operationKey: z.string().trim()
    .min(1, "operationKey cannot be empty.")
    .max(
      StorageTransportFieldLimits.operationKeyMaxLength,
      `operationKey must be ${StorageTransportFieldLimits.operationKeyMaxLength} characters or fewer.`,
    )
    .optional(),
  correlationId: IdentifierSchema.optional(),
  storageInstanceId: StorageInstanceIdSchema,
  backendType: StorageBackendTypeSchema,
  display: DisplayMetadataSchema,
  ownerUserIdentityId: IdentifierSchema,
  access: z.object({
    mode: StorageAccessModeSchema,
    scope: StorageAccessScopeSchema,
  }).strict(),
  replication: StorageReplicationPolicySchema.optional(),
  policy: StoragePolicyInputSchema,
  createdAt: TimestampSchema.optional(),
  lifecycleState: StorageLifecycleStateSchema.optional(),
}).strict();

export const UpdateStorageInstanceRequestDtoSchema: z.ZodType<UpdateStorageInstanceRequestDto> = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  operationKey: z.string().trim()
    .min(1, "operationKey cannot be empty.")
    .max(
      StorageTransportFieldLimits.operationKeyMaxLength,
      `operationKey must be ${StorageTransportFieldLimits.operationKeyMaxLength} characters or fewer.`,
    )
    .optional(),
  correlationId: IdentifierSchema.optional(),
  storageInstanceId: StorageInstanceIdSchema,
  display: DisplayMetadataSchema.partial().optional(),
  policy: StoragePolicyPartialUpdateSchema.optional(),
  replication: StorageReplicationPolicySchema.optional(),
  lifecycleState: StorageLifecycleStateSchema.optional(),
  occurredAt: TimestampSchema.optional(),
}).strict().superRefine((value, context) => {
  if (!value.display && !value.policy && !value.replication && !value.lifecycleState) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["display"],
      message: "Update payload requires at least one mutable field group.",
    });
  }
});

export const ListStorageInstancesRequestDtoSchema: z.ZodType<ListStorageInstancesRequestDto> = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  backendTypes: z.array(StorageBackendTypeSchema).min(1).optional(),
  lifecycleStates: z.array(StorageLifecycleStateSchema).min(1).optional(),
  accessModes: z.array(StorageAccessModeSchema).min(1).optional(),
  accessScopes: z.array(StorageAccessScopeSchema).min(1).optional(),
  limit: z.number().int().min(1, "limit must be >= 1.").max(200, "limit must be <= 200.").optional(),
  offset: z.number().int().min(0, "offset must be >= 0.").optional(),
  occurredAt: TimestampSchema.optional(),
}).strict();

export const GetStorageInstanceDetailRequestDtoSchema: z.ZodType<GetStorageInstanceDetailRequestDto> = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  storageInstanceId: StorageInstanceIdSchema,
  occurredAt: TimestampSchema.optional(),
}).strict();

export const CreateStorageInstanceResponseDtoSchema: z.ZodType<CreateStorageInstanceResponseDto> = z.object({
  storage: StorageInstanceDetailDtoSchema,
}).strict();

export const UpdateStorageInstanceResponseDtoSchema: z.ZodType<UpdateStorageInstanceResponseDto> = z.object({
  storage: StorageInstanceDetailDtoSchema,
}).strict();

export const ListStorageInstancesResponseDtoSchema: z.ZodType<ListStorageInstancesResponseDto> = z.object({
  items: z.array(StorageInstanceSummaryDtoSchema),
}).strict();

export const GetStorageInstanceDetailResponseDtoSchema: z.ZodType<GetStorageInstanceDetailResponseDto> = z.object({
  storage: StorageInstanceDetailDtoSchema,
}).strict();

export type StorageInstanceSummaryDtoPayload = z.infer<typeof StorageInstanceSummaryDtoSchema>;
export type StorageInstanceDetailDtoPayload = z.infer<typeof StorageInstanceDetailDtoSchema>;
export type CreateStorageInstanceRequestDtoPayload = z.infer<typeof CreateStorageInstanceRequestDtoSchema>;
export type UpdateStorageInstanceRequestDtoPayload = z.infer<typeof UpdateStorageInstanceRequestDtoSchema>;
export type ListStorageInstancesRequestDtoPayload = z.infer<typeof ListStorageInstancesRequestDtoSchema>;
export type GetStorageInstanceDetailRequestDtoPayload = z.infer<typeof GetStorageInstanceDetailRequestDtoSchema>;
export type CreateStorageInstanceResponseDtoPayload = z.infer<typeof CreateStorageInstanceResponseDtoSchema>;
export type UpdateStorageInstanceResponseDtoPayload = z.infer<typeof UpdateStorageInstanceResponseDtoSchema>;
export type ListStorageInstancesResponseDtoPayload = z.infer<typeof ListStorageInstancesResponseDtoSchema>;
export type GetStorageInstanceDetailResponseDtoPayload = z.infer<typeof GetStorageInstanceDetailResponseDtoSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): StorageTransportSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new StorageTransportSchemaValidationError(schemaName, issues);
}

function parseStorageTransportSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseCreateStorageInstanceRequestDto(payload: unknown): CreateStorageInstanceRequestDtoPayload {
  return parseStorageTransportSchema(
    "CreateStorageInstanceRequestDto",
    CreateStorageInstanceRequestDtoSchema,
    payload,
  );
}

export function parseUpdateStorageInstanceRequestDto(payload: unknown): UpdateStorageInstanceRequestDtoPayload {
  return parseStorageTransportSchema(
    "UpdateStorageInstanceRequestDto",
    UpdateStorageInstanceRequestDtoSchema,
    payload,
  );
}

export function parseListStorageInstancesRequestDto(payload: unknown): ListStorageInstancesRequestDtoPayload {
  return parseStorageTransportSchema(
    "ListStorageInstancesRequestDto",
    ListStorageInstancesRequestDtoSchema,
    payload,
  );
}

export function parseGetStorageInstanceDetailRequestDto(payload: unknown): GetStorageInstanceDetailRequestDtoPayload {
  return parseStorageTransportSchema(
    "GetStorageInstanceDetailRequestDto",
    GetStorageInstanceDetailRequestDtoSchema,
    payload,
  );
}

export function parseCreateStorageInstanceResponseDto(payload: unknown): CreateStorageInstanceResponseDtoPayload {
  return parseStorageTransportSchema(
    "CreateStorageInstanceResponseDto",
    CreateStorageInstanceResponseDtoSchema,
    payload,
  );
}

export function parseUpdateStorageInstanceResponseDto(payload: unknown): UpdateStorageInstanceResponseDtoPayload {
  return parseStorageTransportSchema(
    "UpdateStorageInstanceResponseDto",
    UpdateStorageInstanceResponseDtoSchema,
    payload,
  );
}

export function parseListStorageInstancesResponseDto(payload: unknown): ListStorageInstancesResponseDtoPayload {
  return parseStorageTransportSchema(
    "ListStorageInstancesResponseDto",
    ListStorageInstancesResponseDtoSchema,
    payload,
  );
}

export function parseGetStorageInstanceDetailResponseDto(
  payload: unknown,
): GetStorageInstanceDetailResponseDtoPayload {
  return parseStorageTransportSchema(
    "GetStorageInstanceDetailResponseDto",
    GetStorageInstanceDetailResponseDtoSchema,
    payload,
  );
}
