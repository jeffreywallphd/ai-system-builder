import { z } from "zod";
import {
  SecretClassificationIds,
  SecretEntryModes,
  toSecretClassificationRegistrySnapshot,
  type SecretClassificationRegistrySnapshot,
} from "../../contracts/security/SecretClassificationContracts";
import { SecretKinds, SecretScopes } from "@domain/security/SecretDomain";

export interface SecretClassificationSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class SecretClassificationSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<SecretClassificationSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<SecretClassificationSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "SecretClassificationSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

export const SecretClassificationIdSchema = z.enum([
  SecretClassificationIds.providerCredential,
  SecretClassificationIds.personalApiKey,
  SecretClassificationIds.storageCredential,
  SecretClassificationIds.signingMaterial,
  SecretClassificationIds.integrationToken,
]);

export const SecretKindSchema = z.enum([
  SecretKinds.apiKey,
  SecretKinds.accessToken,
  SecretKinds.refreshToken,
  SecretKinds.password,
  SecretKinds.privateKey,
  SecretKinds.certificate,
  SecretKinds.connectionString,
  SecretKinds.generic,
]);

export const SecretScopeSchema = z.enum([
  SecretScopes.server,
  SecretScopes.workspace,
  SecretScopes.user,
]);

export const SecretEntryModeSchema = z.enum([
  SecretEntryModes.userEntered,
  SecretEntryModes.systemGenerated,
  SecretEntryModes.either,
]);

export const SecretClassificationMetadataLabelRuleSchema = z.object({
  field: z.string().trim().min(1).max(128).toLowerCase(),
  required: z.boolean(),
  description: z.string().trim().min(1).max(1024),
});

export const SecretClassificationDefinitionSchema = z.object({
  classificationId: SecretClassificationIdSchema,
  description: z.string().trim().min(1).max(1024),
  namePrefix: z.string().trim().min(2).max(64)
    .regex(/^[a-z][a-z0-9-]*\.$/, "Secret classification prefixes must end with '.' and use lowercase segments."),
  allowedKinds: z.array(SecretKindSchema).min(1),
  allowedScopes: z.array(SecretScopeSchema).min(1),
  entryMode: SecretEntryModeSchema,
  metadataLabelRules: z.array(SecretClassificationMetadataLabelRuleSchema),
}).superRefine((value, context) => {
  const duplicateFields = collectDuplicates(value.metadataLabelRules.map((rule) => rule.field));
  if (duplicateFields.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["metadataLabelRules"],
      message: `Duplicate metadata label rules are not allowed: ${duplicateFields.join(", ")}.`,
    });
  }
});

export const SecretClassificationRegistrySnapshotSchema = z.object({
  version: z.number().int().min(1),
  classifications: z.array(SecretClassificationDefinitionSchema).min(1),
}).superRefine((value, context) => {
  const duplicateIds = collectDuplicates(value.classifications.map((entry) => entry.classificationId));
  if (duplicateIds.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["classifications"],
      message: `Duplicate classification ids are not allowed: ${duplicateIds.join(", ")}.`,
    });
  }
});

function collectDuplicates(values: ReadonlyArray<string>): ReadonlyArray<string> {
  const visited = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (visited.has(value)) {
      duplicates.add(value);
      continue;
    }
    visited.add(value);
  }
  return [...duplicates.values()];
}

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path
    .map((segment) => typeof segment === "number" ? `[${segment}]` : segment)
    .join(".")
    .replace(".[", "[");
}

function toValidationError(
  schemaName: string,
  error: z.ZodError,
): SecretClassificationSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new SecretClassificationSchemaValidationError(schemaName, issues);
}

function parseSecretClassificationSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }
  return parsed.data;
}

export function parseSecretClassificationDefinition(payload: unknown): z.infer<typeof SecretClassificationDefinitionSchema> {
  return parseSecretClassificationSchema("SecretClassificationDefinition", SecretClassificationDefinitionSchema, payload);
}

export function parseSecretClassificationRegistrySnapshot(payload: unknown): SecretClassificationRegistrySnapshot {
  return parseSecretClassificationSchema(
    "SecretClassificationRegistrySnapshot",
    SecretClassificationRegistrySnapshotSchema,
    payload,
  );
}

export function createSecretClassificationRegistrySnapshotPayload(): SecretClassificationRegistrySnapshot {
  return parseSecretClassificationRegistrySnapshot(toSecretClassificationRegistrySnapshot());
}

