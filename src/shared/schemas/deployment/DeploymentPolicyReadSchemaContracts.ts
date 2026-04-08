import { z } from "zod";
import {
  DeploymentPolicyGovernanceSensitivityLevels,
  DeploymentProfileIds,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyActiveProfileSourceKinds,
  type ReadDeploymentPolicyStateRequest,
  type ReadDeploymentPolicyStateResponse,
} from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  parseReadDeploymentPolicyAdministrationResponseDto,
} from "@shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts";

export interface DeploymentPolicyReadSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class DeploymentPolicyReadSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<DeploymentPolicyReadSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<DeploymentPolicyReadSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "DeploymentPolicyReadSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256);
const TimestampSchema = z.string().trim().datetime({ offset: true });
const ProfileIdSchema = z.enum([
  DeploymentProfileIds.home,
  DeploymentProfileIds.classroom,
  DeploymentProfileIds.organization,
]);

const ScopeSchema = z.object({
  kind: z.literal(DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope),
  scopeId: IdentifierSchema,
}).strict();

const RequestSchema: z.ZodType<ReadDeploymentPolicyStateRequest> = z.object({
  scope: ScopeSchema,
  actorUserIdentityId: IdentifierSchema,
  profileId: ProfileIdSchema.optional(),
  includeCatalog: z.boolean().optional(),
  includeOverrideRecords: z.boolean().optional(),
  includeEffectiveMetadata: z.boolean().optional(),
  evaluatedAt: TimestampSchema.optional(),
}).strict();

const ActiveProfileSchema = z.object({
  profileId: ProfileIdSchema,
  source: z.enum([
    DeploymentPolicyActiveProfileSourceKinds.persistedSelection,
    DeploymentPolicyActiveProfileSourceKinds.defaultFallback,
  ]),
  selectionRecord: z.object({
    scope: ScopeSchema,
    profileId: ProfileIdSchema,
    changedAt: TimestampSchema,
    changedByUserIdentityId: IdentifierSchema,
    reason: z.string().trim().min(1).max(2048).optional(),
    ticketReference: z.string().trim().min(1).max(256).optional(),
    createdAt: TimestampSchema,
    createdBy: IdentifierSchema,
    lastModifiedAt: TimestampSchema,
    lastModifiedBy: IdentifierSchema,
    revision: z.number().int().min(0),
  }).strict().optional(),
}).strict();

const OverrideRecordSchema = z.object({
  scope: ScopeSchema,
  profileId: ProfileIdSchema,
  familyId: IdentifierSchema,
  settingKey: IdentifierSchema,
  value: z.union([z.string(), z.number().finite(), z.boolean()]),
  valueType: z.enum(["string", "number", "boolean"]),
  provenance: z.object({
    actorUserIdentityId: IdentifierSchema.optional(),
    ticketReference: z.string().trim().min(1).max(256).optional(),
    reason: z.string().trim().min(1).max(2048).optional(),
    updatedAt: TimestampSchema.optional(),
  }).strict().optional(),
  createdAt: TimestampSchema,
  createdBy: IdentifierSchema,
  lastModifiedAt: TimestampSchema,
  lastModifiedBy: IdentifierSchema,
  revision: z.number().int().min(0),
}).strict();

const EffectiveMetadataSchema = z.object({
  scope: ScopeSchema,
  profileId: ProfileIdSchema,
  evaluatedAt: TimestampSchema,
  evaluationLayer: z.enum(["domain", "application"]),
  contractVersion: z.string().trim().min(1),
  familyCount: z.number().int().min(0),
  settingCount: z.number().int().min(0),
  sourceCounts: z.record(z.string(), z.number().int().min(0)),
  validation: z.object({
    valid: z.boolean(),
    issues: z.array(z.object({
      code: z.string().trim().min(1),
      message: z.string().trim().min(1),
      path: z.string().trim().min(1),
    }).strict()),
    evaluatedAt: TimestampSchema,
  }).strict(),
  recordedAt: TimestampSchema,
  recordedByUserIdentityId: IdentifierSchema,
  revision: z.number().int().min(0),
}).strict();

const CatalogSchema = z.object({
  presets: z.record(IdentifierSchema, z.object({
    profileId: ProfileIdSchema,
    parentProfileId: ProfileIdSchema.optional(),
    lineage: z.array(ProfileIdSchema).min(1),
    inheritedFrom: z.array(ProfileIdSchema),
    scope: z.string().trim().min(1),
    rationale: z.string().trim().min(1),
  }).strict()),
  families: z.record(IdentifierSchema, z.object({
    familyId: IdentifierSchema,
    description: z.string().trim().min(1),
    scope: z.string().trim().min(1),
    explainability: z.object({
      behaviorSummary: z.string().trim().min(1),
      governanceSensitivity: z.enum([
        DeploymentPolicyGovernanceSensitivityLevels.standard,
        DeploymentPolicyGovernanceSensitivityLevels.governanceSensitive,
        DeploymentPolicyGovernanceSensitivityLevels.foundational,
      ]),
      governanceWarning: z.string().trim().min(1).optional(),
      governedFeatureAreas: z.array(z.object({
        areaId: IdentifierSchema,
        label: z.string().trim().min(1),
        currentBehavior: z.string().trim().min(1),
      }).strict()).min(1),
    }).strict().optional(),
    settings: z.record(IdentifierSchema, z.object({
      settingKey: IdentifierSchema,
      description: z.string().trim().min(1),
      controlMode: z.string().trim().min(1),
      defaultValue: z.union([z.string(), z.number().finite(), z.boolean()]),
      valueKind: z.enum(["string", "number", "boolean"]),
      validationRules: z.array(z.union([
        z.object({
          type: z.literal("enum"),
          allowedValues: z.array(z.string().trim().min(1)).min(1),
        }).strict(),
        z.object({
          type: z.literal("number-range"),
          min: z.number().finite(),
          max: z.number().finite(),
          integerOnly: z.boolean().optional(),
        }).strict(),
      ])).optional(),
    }).strict()),
  }).strict()),
}).strict();

const ResponseEnvelopeSchema = z.object({
  scope: ScopeSchema,
  authorization: z.object({
    canReadState: z.boolean(),
    canSelectActiveProfile: z.boolean(),
    canManageOverrides: z.boolean(),
    canManageRuntimeAdminOverrides: z.boolean(),
  }).strict(),
  activeProfile: ActiveProfileSchema,
  snapshot: z.unknown(),
  validation: z.unknown(),
  overrideRecords: z.array(OverrideRecordSchema).optional(),
  effectiveMetadata: EffectiveMetadataSchema.optional(),
  catalog: CatalogSchema.optional(),
}).strict();

function formatZodPath(path: ReadonlyArray<string | number>): string {
  if (path.length === 0) {
    return "payload";
  }

  return path.map((segment) => typeof segment === "number" ? `[${segment}]` : segment).join(".").replace(".[", "[");
}

function parseSchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new DeploymentPolicyReadSchemaValidationError(
      schemaName,
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        code: issue.code,
        message: issue.message,
      })),
    );
  }
  return parsed.data;
}

export function parseReadDeploymentPolicyStateRequest(payload: unknown): ReadDeploymentPolicyStateRequest {
  return parseSchema("ReadDeploymentPolicyStateRequest", RequestSchema, payload);
}

export function parseReadDeploymentPolicyStateResponse(payload: unknown): ReadDeploymentPolicyStateResponse {
  const parsed = parseSchema("ReadDeploymentPolicyStateResponse", ResponseEnvelopeSchema, payload);
  try {
    parseReadDeploymentPolicyAdministrationResponseDto({
      snapshot: parsed.snapshot,
      validation: parsed.validation,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new DeploymentPolicyReadSchemaValidationError(
        "ReadDeploymentPolicyStateResponse",
        [Object.freeze({
          path: "snapshot",
          code: "custom",
          message: error.message,
        })],
      );
    }
    throw error;
  }
  return parsed as ReadDeploymentPolicyStateResponse;
}
