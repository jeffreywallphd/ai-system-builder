import { z } from "zod";
import {
  PersistenceSensitiveFieldProtections,
  PersistenceTenancyScopes,
} from "../../dto/persistence/PersistenceBoundaryDtos";

export interface PersistenceSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class PersistenceSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<PersistenceSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<PersistenceSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "PersistenceSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierPattern = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/;

export const PersistenceIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Identifier is required.")
  .max(256, "Identifier must be 256 characters or fewer.")
  .regex(IdentifierPattern, "Identifier must use alphanumeric, ':', '_' or '-' characters.");

export const PersistenceTimestampSchema = z
  .string()
  .trim()
  .min(1, "Timestamp is required.")
  .datetime({ offset: true });

export const PersistenceRevisionSchema = z.number().int().nonnegative();
export const PersistenceSchemaVersionSchema = z.number().int().positive();
export const PersistenceRecordVersionSchema = z.number().int().positive();

export const PersistenceTenancyScopeSchema = z.enum([
  PersistenceTenancyScopes.platform,
  PersistenceTenancyScopes.workspace,
  PersistenceTenancyScopes.user,
  PersistenceTenancyScopes.node,
  PersistenceTenancyScopes.mixed,
]);

export const PersistenceTenancyMetadataSchema = z.object({
  scope: PersistenceTenancyScopeSchema,
  workspaceId: PersistenceIdentifierSchema.optional(),
  userIdentityId: PersistenceIdentifierSchema.optional(),
  nodeId: PersistenceIdentifierSchema.optional(),
}).superRefine((value, context) => {
  if (value.scope === PersistenceTenancyScopes.workspace && !value.workspaceId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["workspaceId"],
      message: "Workspace tenancy scope requires workspaceId.",
    });
  }

  if (value.scope === PersistenceTenancyScopes.user && !value.userIdentityId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["userIdentityId"],
      message: "User tenancy scope requires userIdentityId.",
    });
  }

  if (value.scope === PersistenceTenancyScopes.node && !value.nodeId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nodeId"],
      message: "Node tenancy scope requires nodeId.",
    });
  }
});

export const PersistenceAuditStampSchema = z.object({
  createdAt: PersistenceTimestampSchema,
  createdBy: PersistenceIdentifierSchema,
  lastModifiedAt: PersistenceTimestampSchema,
  lastModifiedBy: PersistenceIdentifierSchema,
});

export const PersistenceVersionMetadataSchema = z.object({
  revision: PersistenceRevisionSchema,
  schemaVersion: PersistenceSchemaVersionSchema,
  recordVersion: PersistenceRecordVersionSchema.optional(),
});

export const PersistenceSensitiveFieldProtectionSchema = z.enum([
  PersistenceSensitiveFieldProtections.none,
  PersistenceSensitiveFieldProtections.hashed,
  PersistenceSensitiveFieldProtections.encrypted,
  PersistenceSensitiveFieldProtections.tokenized,
  PersistenceSensitiveFieldProtections.redacted,
]);

export const PersistenceSensitiveFieldDescriptorSchema = z.object({
  fieldPath: z.string().trim().min(1).max(256),
  protection: PersistenceSensitiveFieldProtectionSchema,
  classification: z.string().trim().min(1).max(128).optional(),
  keyReferenceId: PersistenceIdentifierSchema.optional(),
});

export const PersistenceMutationContextSchema = z.object({
  operationKey: PersistenceIdentifierSchema,
  actorId: PersistenceIdentifierSchema,
  occurredAt: PersistenceTimestampSchema.optional(),
  correlationId: PersistenceIdentifierSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
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

function toValidationError(schemaName: string, error: z.ZodError): PersistenceSchemaValidationError {
  const issues = error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));

  return new PersistenceSchemaValidationError(schemaName, issues);
}

export function parsePersistenceSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw toValidationError(schemaName, parsed.error);
  }

  return parsed.data;
}
