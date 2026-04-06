import { z } from "zod";
import { SecretKinds, SecretScopes, createSecretScopeOwner } from "../../../domain/security/SecretDomain";
import {
  SecretClassificationIds,
  findSecretClassificationById,
} from "../../contracts/security/SecretClassificationContracts";
import {
  SecretRotationInstructionModes,
  SecretTransportFieldLimits,
  SecretTransportPatterns,
} from "../../contracts/security/SecretTransportContracts";
import type {
  CreateSecretCommandDto,
  DisableSecretCommandDto,
  GetSecretMetadataQueryDto,
  ListSecretMetadataQueryDto,
} from "../../dto/security/SecretTransportDtos";

export interface SecretApiSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class SecretApiSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<SecretApiSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<SecretApiSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "SecretApiSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const SecretScopeSchema = z.enum([
  SecretScopes.server,
  SecretScopes.workspace,
  SecretScopes.user,
]);

const SecretKindSchema = z.enum([
  SecretKinds.apiKey,
  SecretKinds.accessToken,
  SecretKinds.refreshToken,
  SecretKinds.password,
  SecretKinds.privateKey,
  SecretKinds.certificate,
  SecretKinds.connectionString,
  SecretKinds.generic,
]);

const SecretClassificationIdSchema = z.enum([
  SecretClassificationIds.providerCredential,
  SecretClassificationIds.personalApiKey,
  SecretClassificationIds.storageCredential,
  SecretClassificationIds.signingMaterial,
  SecretClassificationIds.integrationToken,
]);

const ScopeIdentifierSchema = z.string().trim()
  .min(1, "Identifier is required.")
  .max(SecretTransportFieldLimits.secretIdMaxLength, `Identifier must be ${SecretTransportFieldLimits.secretIdMaxLength} characters or fewer.`)
  .regex(SecretTransportPatterns.scopeIdentifier, "Identifier format is invalid.");

const SecretIdSchema = z.string().trim()
  .min(1, "secretId is required.")
  .max(SecretTransportFieldLimits.secretIdMaxLength, `secretId must be ${SecretTransportFieldLimits.secretIdMaxLength} characters or fewer.`)
  .regex(SecretTransportPatterns.scopeIdentifier, "secretId format is invalid.");

const SecretNameSchema = z.string().trim().toLowerCase()
  .min(1, "name is required.")
  .max(SecretTransportFieldLimits.secretNameMaxLength, `name must be ${SecretTransportFieldLimits.secretNameMaxLength} characters or fewer.`)
  .regex(SecretTransportPatterns.secretKey, "name must use lowercase letters, numbers, '.', '_' or '-' and start with a letter.");

const DisplayNameSchema = z.string().trim()
  .min(1, "displayName cannot be empty.")
  .max(SecretTransportFieldLimits.displayNameMaxLength, `displayName must be ${SecretTransportFieldLimits.displayNameMaxLength} characters or fewer.`);

const DescriptionSchema = z.string().trim()
  .min(1, "description cannot be empty.")
  .max(SecretTransportFieldLimits.descriptionMaxLength, `description must be ${SecretTransportFieldLimits.descriptionMaxLength} characters or fewer.`);

const TagSchema = z.string().trim().toLowerCase()
  .min(1, "tags cannot contain empty values.")
  .max(SecretTransportFieldLimits.tagMaxLength, `tags entries must be ${SecretTransportFieldLimits.tagMaxLength} characters or fewer.`);

const MetadataLabelValueSchema = z.string().trim()
  .min(1, "metadata.labels values cannot be empty.")
  .max(SecretTransportFieldLimits.labelValueMaxLength, `metadata.labels values must be ${SecretTransportFieldLimits.labelValueMaxLength} characters or fewer.`);

const MetadataLabelUnsafeKeyPattern = /(secret|password|token|credential|private|key|pem|csr)/i;

const MetadataLabelKeySchema = z.string().trim().toLowerCase()
  .min(1, "metadata.labels keys cannot be empty.")
  .max(SecretTransportFieldLimits.labelKeyMaxLength, `metadata.labels keys must be ${SecretTransportFieldLimits.labelKeyMaxLength} characters or fewer.`)
  .regex(SecretTransportPatterns.metadataLabelKey, "metadata.labels keys must use lowercase letters, numbers, '.', '_' or '-' and start with a letter.")
  .refine((key) => !MetadataLabelUnsafeKeyPattern.test(key), {
    message: "metadata.labels keys must be redaction-safe.",
  });

const SecretOwnerSchema = z.object({
  scope: SecretScopeSchema,
  workspaceId: ScopeIdentifierSchema.optional(),
  userIdentityId: ScopeIdentifierSchema.optional(),
}).strict().superRefine((value, context) => {
  try {
    createSecretScopeOwner(value);
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scope"],
      message: error instanceof Error ? error.message : "Secret owner scope is invalid.",
    });
  }
});

const SecretMetadataInputSchema = z.object({
  displayName: DisplayNameSchema.optional(),
  description: DescriptionSchema.optional(),
  tags: z.array(TagSchema).max(SecretTransportFieldLimits.maxTags, `tags can include up to ${SecretTransportFieldLimits.maxTags} values.`).optional(),
  labels: z.record(MetadataLabelKeySchema, MetadataLabelValueSchema).optional(),
}).strict();

const SecretRotationInstructionSchema = z.object({
  mode: z.enum([
    SecretRotationInstructionModes.manual,
    SecretRotationInstructionModes.scheduled,
    SecretRotationInstructionModes.onDemand,
  ]),
  rotateEveryDays: z.number().int().min(1, "rotationInstruction.rotateEveryDays must be >= 1.").max(3650, "rotationInstruction.rotateEveryDays must be <= 3650.").optional(),
  nextRotationDueAt: z.string().datetime({ offset: true }).optional(),
  note: z.string().trim().min(1).max(SecretTransportFieldLimits.rotationNoteMaxLength).optional(),
}).strict().superRefine((value, context) => {
  if (value.mode === SecretRotationInstructionModes.scheduled && !value.rotateEveryDays && !value.nextRotationDueAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["rotateEveryDays"],
      message: "rotationInstruction with mode 'scheduled' requires rotateEveryDays or nextRotationDueAt.",
    });
  }
});

const OptionalOperationKeySchema = z.string().trim()
  .min(1, "operationKey cannot be empty.")
  .max(SecretTransportFieldLimits.operationKeyMaxLength, `operationKey must be ${SecretTransportFieldLimits.operationKeyMaxLength} characters or fewer.`)
  .optional();

export const CreateSecretMetadataCommandSchema: z.ZodType<CreateSecretCommandDto> = z.object({
  operationKey: OptionalOperationKeySchema,
  secretId: SecretIdSchema,
  name: SecretNameSchema,
  owner: SecretOwnerSchema,
  kind: SecretKindSchema,
  plaintext: z.string().min(1, "plaintext is required."),
  metadata: SecretMetadataInputSchema.optional(),
  classificationId: SecretClassificationIdSchema.optional(),
  rotationInstruction: SecretRotationInstructionSchema.optional(),
  createdAt: z.string().datetime({ offset: true }).optional(),
}).strict().superRefine((value, context) => {
  if (!value.classificationId) {
    return;
  }

  const classification = findSecretClassificationById(value.classificationId);
  if (!classification) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["classificationId"],
      message: `classificationId '${value.classificationId}' is not supported.`,
    });
    return;
  }

  if (!value.name.startsWith(classification.namePrefix)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: `name must use '${classification.namePrefix}' prefix for classification '${value.classificationId}'.`,
    });
  }

  if (!classification.allowedKinds.includes(value.kind)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["kind"],
      message: `kind '${value.kind}' is not allowed for classification '${value.classificationId}'.`,
    });
  }

  if (!classification.allowedScopes.includes(value.owner.scope)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["owner", "scope"],
      message: `scope '${value.owner.scope}' is not allowed for classification '${value.classificationId}'.`,
    });
  }
});

export const ListSecretMetadataQuerySchema: z.ZodType<ListSecretMetadataQueryDto> = z.object({
  owner: SecretOwnerSchema,
  actorWorkspaceId: ScopeIdentifierSchema.optional(),
  kinds: z.array(SecretKindSchema).min(1).optional(),
  tagAnyOf: z.array(TagSchema).min(1).optional(),
  includeDisabled: z.boolean().optional(),
  includeRevoked: z.boolean().optional(),
  includeDeleted: z.boolean().optional(),
  limit: z.number().int().min(1, "limit must be an integer >= 1.").max(200, "limit must be <= 200.").optional(),
  offset: z.number().int().min(0, "offset must be an integer >= 0.").optional(),
}).strict();

export const GetSecretMetadataQuerySchema: z.ZodType<GetSecretMetadataQueryDto> = z.object({
  secretId: SecretIdSchema,
  actorWorkspaceId: ScopeIdentifierSchema.optional(),
  occurredAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export const DisableSecretMetadataCommandSchema: z.ZodType<DisableSecretCommandDto> = z.object({
  secretId: SecretIdSchema,
  operationKey: OptionalOperationKeySchema,
  disabledAt: z.string().datetime({ offset: true }).optional(),
  actorWorkspaceId: ScopeIdentifierSchema.optional(),
}).strict();

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(schemaName: string, error: z.ZodError): SecretApiSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new SecretApiSchemaValidationError(schemaName, issues);
}

function parseSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseCreateSecretMetadataCommand(payload: unknown): CreateSecretCommandDto {
  return parseSchema("CreateSecretMetadataCommand", CreateSecretMetadataCommandSchema, payload);
}

export function parseListSecretMetadataQuery(payload: unknown): ListSecretMetadataQueryDto {
  return parseSchema("ListSecretMetadataQuery", ListSecretMetadataQuerySchema, payload);
}

export function parseGetSecretMetadataQuery(payload: unknown): GetSecretMetadataQueryDto {
  return parseSchema("GetSecretMetadataQuery", GetSecretMetadataQuerySchema, payload);
}

export function parseDisableSecretMetadataCommand(payload: unknown): DisableSecretCommandDto {
  return parseSchema("DisableSecretMetadataCommand", DisableSecretMetadataCommandSchema, payload);
}
