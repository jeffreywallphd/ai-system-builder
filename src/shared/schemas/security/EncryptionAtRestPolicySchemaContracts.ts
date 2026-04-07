import { z } from "zod";
import {
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  EncryptionPolicyEvaluationSources,
  ProtectedDataClasses,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  EncryptionAtRestPolicyContractVersions,
  type DecryptionAllowanceDto,
  type EncryptedMaterialDescriptorDto,
  type EncryptedMaterialReferenceDto,
  type EncryptionAtRestPolicyDefinitionDto,
  type EncryptionPolicyEvaluationResultDto,
  type MetadataProtectionConfigurationDto,
  type ProtectedDataEncryptionRuleDto,
  type StorageInstanceEncryptionAtRestPolicyDto,
  type WorkspaceEncryptionAtRestPolicyDto,
} from "../../contracts/security/EncryptionAtRestPolicyContracts";
import type {
  GetEffectiveEncryptionAtRestPolicyRequestDto,
  GetEffectiveEncryptionAtRestPolicyResponseDto,
  UpsertStorageInstanceEncryptionAtRestPolicyRequestDto,
  UpsertStorageInstanceEncryptionAtRestPolicyResponseDto,
  UpsertWorkspaceEncryptionAtRestPolicyRequestDto,
  UpsertWorkspaceEncryptionAtRestPolicyResponseDto,
  ValidateEncryptedMaterialDescriptorRequestDto,
  ValidateEncryptedMaterialDescriptorResponseDto,
} from "../../dto/security/EncryptionAtRestPolicyDtos";

export interface EncryptionAtRestPolicySchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class EncryptionAtRestPolicySchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<EncryptionAtRestPolicySchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<EncryptionAtRestPolicySchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "EncryptionAtRestPolicySchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(127)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,126}$/, "Identifier format is invalid.");

const TimestampSchema = z.string().trim().datetime({ offset: true });

const EncryptionModeSchema = z.enum([
  EncryptionModes.none,
  EncryptionModes.metadataOnly,
  EncryptionModes.scopedContent,
]);

const EncryptionKeyScopeSchema = z.enum([
  EncryptionKeyScopes.server,
  EncryptionKeyScopes.workspace,
  EncryptionKeyScopes.storageInstance,
]);

const EncryptionPolicyScopeSchema = z.enum([
  EncryptionPolicyScopes.platform,
  EncryptionPolicyScopes.workspace,
  EncryptionPolicyScopes.storageInstance,
]);

const EncryptionPolicyEvaluationSourceSchema = z.enum([
  EncryptionPolicyEvaluationSources.platform,
  EncryptionPolicyEvaluationSources.workspace,
  EncryptionPolicyEvaluationSources.storageInstance,
]);

const ProtectedDataClassSchema = z.enum([
  ProtectedDataClasses.secretMaterial,
  ProtectedDataClasses.secretMetadata,
  ProtectedDataClasses.sensitiveMetadata,
  ProtectedDataClasses.assetContent,
]);

const DecryptionAllowanceSchema: z.ZodType<DecryptionAllowanceDto> = z.object({
  allowPreviewDecryption: z.boolean(),
  allowWorkerDecryption: z.boolean(),
}).strict();

const ProtectedDataEncryptionRuleSchema: z.ZodType<ProtectedDataEncryptionRuleDto> = z.object({
  dataClass: ProtectedDataClassSchema,
  encryptionMode: EncryptionModeSchema,
  keyScope: EncryptionKeyScopeSchema.optional(),
  decryption: DecryptionAllowanceSchema,
  allowPreviewDecryption: z.boolean(),
  allowWorkerDecryption: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.allowPreviewDecryption !== value.decryption.allowPreviewDecryption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowPreviewDecryption"],
      message: "allowPreviewDecryption must match decryption.allowPreviewDecryption.",
    });
  }

  if (value.allowWorkerDecryption !== value.decryption.allowWorkerDecryption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowWorkerDecryption"],
      message: "allowWorkerDecryption must match decryption.allowWorkerDecryption.",
    });
  }

  if (value.encryptionMode === EncryptionModes.none) {
    if (value.keyScope) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["keyScope"],
        message: "encryptionMode='none' cannot include keyScope.",
      });
    }

    if (value.allowPreviewDecryption || value.allowWorkerDecryption) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowPreviewDecryption"],
        message: "encryptionMode='none' cannot allow preview or worker decryption.",
      });
    }
  }

  if (value.encryptionMode === EncryptionModes.scopedContent && !value.keyScope) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["keyScope"],
      message: "encryptionMode='scoped-content' requires keyScope.",
    });
  }

  if (value.encryptionMode !== EncryptionModes.scopedContent && value.allowWorkerDecryption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowWorkerDecryption"],
      message: "allowWorkerDecryption is only valid when encryptionMode='scoped-content'.",
    });
  }

  if (value.encryptionMode === EncryptionModes.metadataOnly && value.allowPreviewDecryption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowPreviewDecryption"],
      message: "metadata-only encryption cannot allow preview decryption.",
    });
  }

  if (value.dataClass === ProtectedDataClasses.secretMaterial) {
    if (value.encryptionMode !== EncryptionModes.scopedContent) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["encryptionMode"],
        message: "secret-material requires encryptionMode='scoped-content'.",
      });
    }

    if (value.allowPreviewDecryption || value.allowWorkerDecryption) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowPreviewDecryption"],
        message: "secret-material cannot allow preview or worker decryption.",
      });
    }
  }

  if (
    value.dataClass === ProtectedDataClasses.secretMetadata
    || value.dataClass === ProtectedDataClasses.sensitiveMetadata
  ) {
    if (value.encryptionMode === EncryptionModes.none) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["encryptionMode"],
        message: `${value.dataClass} cannot use encryptionMode='none'.`,
      });
    }

    if (value.allowPreviewDecryption || value.allowWorkerDecryption) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowPreviewDecryption"],
        message: `${value.dataClass} cannot allow preview or worker decryption.`,
      });
    }
  }
});

const EncryptionAtRestPolicyDefinitionSchema = z.object({
  policyId: IdentifierSchema,
  scope: EncryptionPolicyScopeSchema,
  workspaceId: IdentifierSchema.optional(),
  storageInstanceId: IdentifierSchema.optional(),
  rules: z.array(ProtectedDataEncryptionRuleSchema),
}).strict().superRefine((value, context) => {
  const seenClasses = new Set<string>();
  for (const [index, rule] of value.rules.entries()) {
    if (seenClasses.has(rule.dataClass)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rules", index, "dataClass"],
        message: `Duplicate rule for '${rule.dataClass}' is not allowed.`,
      });
      continue;
    }
    seenClasses.add(rule.dataClass);
  }

  if (value.scope === EncryptionPolicyScopes.platform) {
    if (value.workspaceId || value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "platform scope cannot include workspaceId or storageInstanceId.",
      });
    }

    for (const required of [
      ProtectedDataClasses.secretMaterial,
      ProtectedDataClasses.secretMetadata,
      ProtectedDataClasses.sensitiveMetadata,
    ]) {
      if (!seenClasses.has(required)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules"],
          message: `platform scope must include a '${required}' rule.`,
        });
      }
    }
  }

  if (value.scope === EncryptionPolicyScopes.workspace) {
    if (!value.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "workspace scope requires workspaceId.",
      });
    }

    if (value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageInstanceId"],
        message: "workspace scope cannot include storageInstanceId.",
      });
    }
  }

  if (value.scope === EncryptionPolicyScopes.storageInstance) {
    if (!value.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "storage-instance scope requires workspaceId.",
      });
    }

    if (!value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageInstanceId"],
        message: "storage-instance scope requires storageInstanceId.",
      });
    }
  }
});

const MetadataProtectionConfigurationSchema: z.ZodType<MetadataProtectionConfigurationDto> = z.object({
  secretMetadata: ProtectedDataEncryptionRuleSchema,
  sensitiveMetadata: ProtectedDataEncryptionRuleSchema,
}).strict().superRefine((value, context) => {
  if (value.secretMetadata.dataClass !== ProtectedDataClasses.secretMetadata) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["secretMetadata", "dataClass"],
      message: "secretMetadata must carry dataClass='secret-metadata'.",
    });
  }

  if (value.sensitiveMetadata.dataClass !== ProtectedDataClasses.sensitiveMetadata) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sensitiveMetadata", "dataClass"],
      message: "sensitiveMetadata must carry dataClass='sensitive-metadata'.",
    });
  }
});

const WorkspaceEncryptionAtRestPolicySchema: z.ZodType<WorkspaceEncryptionAtRestPolicyDto> =
  EncryptionAtRestPolicyDefinitionSchema.extend({
    scope: z.literal(EncryptionPolicyScopes.workspace),
    workspaceId: IdentifierSchema,
    metadataProtection: MetadataProtectionConfigurationSchema,
  }).strict().superRefine((value, context) => {
    if (value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageInstanceId"],
        message: "workspace policy payload cannot include storageInstanceId.",
      });
    }
  });

const StorageInstanceEncryptionAtRestPolicySchema: z.ZodType<StorageInstanceEncryptionAtRestPolicyDto> =
  EncryptionAtRestPolicyDefinitionSchema.extend({
    scope: z.literal(EncryptionPolicyScopes.storageInstance),
    workspaceId: IdentifierSchema,
    storageInstanceId: IdentifierSchema,
    metadataProtection: MetadataProtectionConfigurationSchema,
  }).strict();

const EncryptionPolicyEvaluationResultSchema: z.ZodType<EncryptionPolicyEvaluationResultDto> = z.object({
  dataClass: ProtectedDataClassSchema,
  resolvedFrom: EncryptionPolicyEvaluationSourceSchema,
  inheritedFrom: z.array(EncryptionPolicyEvaluationSourceSchema),
  encryptedAtRestRequired: z.boolean(),
  requiresScopedContentKey: z.boolean(),
  allowPreviewDecryption: z.boolean(),
  allowWorkerDecryption: z.boolean(),
  effectiveRule: ProtectedDataEncryptionRuleSchema,
}).strict().superRefine((value, context) => {
  if (value.effectiveRule.dataClass !== value.dataClass) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["effectiveRule", "dataClass"],
      message: "effectiveRule.dataClass must match dataClass.",
    });
  }

  if (value.allowPreviewDecryption !== value.effectiveRule.allowPreviewDecryption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowPreviewDecryption"],
      message: "allowPreviewDecryption must match effectiveRule.allowPreviewDecryption.",
    });
  }

  if (value.allowWorkerDecryption !== value.effectiveRule.allowWorkerDecryption) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allowWorkerDecryption"],
      message: "allowWorkerDecryption must match effectiveRule.allowWorkerDecryption.",
    });
  }
});

const EncryptedMaterialReferenceSchema: z.ZodType<EncryptedMaterialReferenceDto> = z.object({
  materialId: IdentifierSchema,
  encryptedLocator: z.string().trim().min(1).max(2048),
  algorithm: z.string().trim().min(1).max(128),
  keyReferenceId: IdentifierSchema,
  keyScope: EncryptionKeyScopeSchema,
  encryptedAt: TimestampSchema,
  payloadDigestSha256: z.string().trim().regex(/^[a-f0-9]{64}$/i, "payloadDigestSha256 must be a SHA-256 hex digest.").optional(),
}).strict();

const EncryptedMaterialDescriptorSchema: z.ZodType<EncryptedMaterialDescriptorDto> = z.object({
  contractVersion: z.literal(EncryptionAtRestPolicyContractVersions.v1),
  dataClass: ProtectedDataClassSchema,
  policyId: IdentifierSchema,
  policyScope: EncryptionPolicyScopeSchema,
  workspaceId: IdentifierSchema.optional(),
  storageInstanceId: IdentifierSchema.optional(),
  reference: EncryptedMaterialReferenceSchema,
}).strict().superRefine((value, context) => {
  if (value.policyScope === EncryptionPolicyScopes.platform) {
    if (value.workspaceId || value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "platform-scoped descriptors cannot include workspaceId or storageInstanceId.",
      });
    }
  }

  if (value.policyScope === EncryptionPolicyScopes.workspace) {
    if (!value.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "workspace-scoped descriptors require workspaceId.",
      });
    }

    if (value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageInstanceId"],
        message: "workspace-scoped descriptors cannot include storageInstanceId.",
      });
    }
  }

  if (value.policyScope === EncryptionPolicyScopes.storageInstance) {
    if (!value.workspaceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["workspaceId"],
        message: "storage-instance-scoped descriptors require workspaceId.",
      });
    }

    if (!value.storageInstanceId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["storageInstanceId"],
        message: "storage-instance-scoped descriptors require storageInstanceId.",
      });
    }
  }
});

export const UpsertWorkspaceEncryptionAtRestPolicyRequestDtoSchema: z.ZodType<
  UpsertWorkspaceEncryptionAtRestPolicyRequestDto
> = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  operationKey: z.string().trim().min(1).max(255).optional(),
  correlationId: IdentifierSchema.optional(),
  policy: WorkspaceEncryptionAtRestPolicySchema,
  occurredAt: TimestampSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.workspaceId !== value.policy.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["workspaceId"],
      message: "workspaceId must match policy.workspaceId.",
    });
  }
});

export const UpsertWorkspaceEncryptionAtRestPolicyResponseDtoSchema: z.ZodType<
  UpsertWorkspaceEncryptionAtRestPolicyResponseDto
> = z.object({
  policy: WorkspaceEncryptionAtRestPolicySchema,
}).strict();

export const UpsertStorageInstanceEncryptionAtRestPolicyRequestDtoSchema: z.ZodType<
  UpsertStorageInstanceEncryptionAtRestPolicyRequestDto
> = z.object({
  actorUserIdentityId: IdentifierSchema,
  workspaceId: IdentifierSchema,
  storageInstanceId: IdentifierSchema,
  operationKey: z.string().trim().min(1).max(255).optional(),
  correlationId: IdentifierSchema.optional(),
  policy: StorageInstanceEncryptionAtRestPolicySchema,
  occurredAt: TimestampSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.workspaceId !== value.policy.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["workspaceId"],
      message: "workspaceId must match policy.workspaceId.",
    });
  }

  if (value.storageInstanceId !== value.policy.storageInstanceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["storageInstanceId"],
      message: "storageInstanceId must match policy.storageInstanceId.",
    });
  }
});

export const UpsertStorageInstanceEncryptionAtRestPolicyResponseDtoSchema: z.ZodType<
  UpsertStorageInstanceEncryptionAtRestPolicyResponseDto
> = z.object({
  policy: StorageInstanceEncryptionAtRestPolicySchema,
}).strict();

export const GetEffectiveEncryptionAtRestPolicyRequestDtoSchema: z.ZodType<GetEffectiveEncryptionAtRestPolicyRequestDto> = z.object({
  actorUserIdentityId: IdentifierSchema.optional(),
  workspaceId: IdentifierSchema,
  storageInstanceId: IdentifierSchema.optional(),
  dataClass: ProtectedDataClassSchema,
  occurredAt: TimestampSchema.optional(),
}).strict();

export const GetEffectiveEncryptionAtRestPolicyResponseDtoSchema: z.ZodType<GetEffectiveEncryptionAtRestPolicyResponseDto> = z.object({
  evaluation: EncryptionPolicyEvaluationResultSchema,
  resolvedPolicy: EncryptionAtRestPolicyDefinitionSchema,
}).strict();

export const ValidateEncryptedMaterialDescriptorRequestDtoSchema: z.ZodType<
  ValidateEncryptedMaterialDescriptorRequestDto
> = z.object({
  workspaceId: IdentifierSchema,
  storageInstanceId: IdentifierSchema.optional(),
  descriptor: EncryptedMaterialDescriptorSchema,
  expectedDataClass: ProtectedDataClassSchema,
  occurredAt: TimestampSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.expectedDataClass !== value.descriptor.dataClass) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expectedDataClass"],
      message: "expectedDataClass must match descriptor.dataClass.",
    });
  }

  if (value.workspaceId !== value.descriptor.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["workspaceId"],
      message: "workspaceId must match descriptor.workspaceId.",
    });
  }

  if (value.storageInstanceId !== value.descriptor.storageInstanceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["storageInstanceId"],
      message: "storageInstanceId must match descriptor.storageInstanceId.",
    });
  }
});

export const ValidateEncryptedMaterialDescriptorResponseDtoSchema: z.ZodType<
  ValidateEncryptedMaterialDescriptorResponseDto
> = z.object({
  valid: z.boolean(),
  violations: z.array(z.string().trim().min(1)),
}).strict();

export type ProtectedDataEncryptionRulePayload = z.infer<typeof ProtectedDataEncryptionRuleSchema>;
export type EncryptionAtRestPolicyDefinitionPayload = z.infer<typeof EncryptionAtRestPolicyDefinitionSchema>;
export type WorkspaceEncryptionAtRestPolicyPayload = z.infer<typeof WorkspaceEncryptionAtRestPolicySchema>;
export type StorageInstanceEncryptionAtRestPolicyPayload = z.infer<typeof StorageInstanceEncryptionAtRestPolicySchema>;
export type EncryptionPolicyEvaluationResultPayload = z.infer<typeof EncryptionPolicyEvaluationResultSchema>;
export type EncryptedMaterialDescriptorPayload = z.infer<typeof EncryptedMaterialDescriptorSchema>;

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): EncryptionAtRestPolicySchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new EncryptionAtRestPolicySchemaValidationError(schemaName, issues);
}

function parseEncryptionPolicySchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseEncryptionAtRestPolicyDefinitionDto(payload: unknown): EncryptionAtRestPolicyDefinitionPayload {
  return parseEncryptionPolicySchema(
    "EncryptionAtRestPolicyDefinitionDto",
    EncryptionAtRestPolicyDefinitionSchema,
    payload,
  );
}

export function parseWorkspaceEncryptionAtRestPolicyDto(payload: unknown): WorkspaceEncryptionAtRestPolicyPayload {
  return parseEncryptionPolicySchema(
    "WorkspaceEncryptionAtRestPolicyDto",
    WorkspaceEncryptionAtRestPolicySchema,
    payload,
  );
}

export function parseStorageInstanceEncryptionAtRestPolicyDto(
  payload: unknown,
): StorageInstanceEncryptionAtRestPolicyPayload {
  return parseEncryptionPolicySchema(
    "StorageInstanceEncryptionAtRestPolicyDto",
    StorageInstanceEncryptionAtRestPolicySchema,
    payload,
  );
}

export function parseEncryptionPolicyEvaluationResultDto(payload: unknown): EncryptionPolicyEvaluationResultPayload {
  return parseEncryptionPolicySchema(
    "EncryptionPolicyEvaluationResultDto",
    EncryptionPolicyEvaluationResultSchema,
    payload,
  );
}

export function parseEncryptedMaterialDescriptorDto(payload: unknown): EncryptedMaterialDescriptorPayload {
  return parseEncryptionPolicySchema(
    "EncryptedMaterialDescriptorDto",
    EncryptedMaterialDescriptorSchema,
    payload,
  );
}

export function parseUpsertWorkspaceEncryptionAtRestPolicyRequestDto(
  payload: unknown,
): UpsertWorkspaceEncryptionAtRestPolicyRequestDto {
  return parseEncryptionPolicySchema(
    "UpsertWorkspaceEncryptionAtRestPolicyRequestDto",
    UpsertWorkspaceEncryptionAtRestPolicyRequestDtoSchema,
    payload,
  );
}

export function parseUpsertWorkspaceEncryptionAtRestPolicyResponseDto(
  payload: unknown,
): UpsertWorkspaceEncryptionAtRestPolicyResponseDto {
  return parseEncryptionPolicySchema(
    "UpsertWorkspaceEncryptionAtRestPolicyResponseDto",
    UpsertWorkspaceEncryptionAtRestPolicyResponseDtoSchema,
    payload,
  );
}

export function parseUpsertStorageInstanceEncryptionAtRestPolicyRequestDto(
  payload: unknown,
): UpsertStorageInstanceEncryptionAtRestPolicyRequestDto {
  return parseEncryptionPolicySchema(
    "UpsertStorageInstanceEncryptionAtRestPolicyRequestDto",
    UpsertStorageInstanceEncryptionAtRestPolicyRequestDtoSchema,
    payload,
  );
}

export function parseUpsertStorageInstanceEncryptionAtRestPolicyResponseDto(
  payload: unknown,
): UpsertStorageInstanceEncryptionAtRestPolicyResponseDto {
  return parseEncryptionPolicySchema(
    "UpsertStorageInstanceEncryptionAtRestPolicyResponseDto",
    UpsertStorageInstanceEncryptionAtRestPolicyResponseDtoSchema,
    payload,
  );
}

export function parseGetEffectiveEncryptionAtRestPolicyRequestDto(
  payload: unknown,
): GetEffectiveEncryptionAtRestPolicyRequestDto {
  return parseEncryptionPolicySchema(
    "GetEffectiveEncryptionAtRestPolicyRequestDto",
    GetEffectiveEncryptionAtRestPolicyRequestDtoSchema,
    payload,
  );
}

export function parseGetEffectiveEncryptionAtRestPolicyResponseDto(
  payload: unknown,
): GetEffectiveEncryptionAtRestPolicyResponseDto {
  return parseEncryptionPolicySchema(
    "GetEffectiveEncryptionAtRestPolicyResponseDto",
    GetEffectiveEncryptionAtRestPolicyResponseDtoSchema,
    payload,
  );
}

export function parseValidateEncryptedMaterialDescriptorRequestDto(
  payload: unknown,
): ValidateEncryptedMaterialDescriptorRequestDto {
  return parseEncryptionPolicySchema(
    "ValidateEncryptedMaterialDescriptorRequestDto",
    ValidateEncryptedMaterialDescriptorRequestDtoSchema,
    payload,
  );
}

export function parseValidateEncryptedMaterialDescriptorResponseDto(
  payload: unknown,
): ValidateEncryptedMaterialDescriptorResponseDto {
  return parseEncryptionPolicySchema(
    "ValidateEncryptedMaterialDescriptorResponseDto",
    ValidateEncryptedMaterialDescriptorResponseDtoSchema,
    payload,
  );
}

