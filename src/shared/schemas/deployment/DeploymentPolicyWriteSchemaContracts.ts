import { z } from "zod";
import {
  DeploymentPolicyControlModes,
  DeploymentProfileIds,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyUpdateOperationKinds,
  DeploymentPolicyValueKinds,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  ApplyDeploymentPolicyOverrideOperationsRequest,
  ApplyDeploymentPolicyOverrideOperationsResponse,
  UpdateDeploymentPolicyActiveProfileRequest,
  UpdateDeploymentPolicyActiveProfileResponse,
} from "@shared/contracts/deployment/DeploymentPolicyWriteContracts";
import { DeploymentPolicyPersistenceScopeKinds } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  parseDeploymentPolicyAdministrationSnapshot,
  parseValidateDeploymentPolicyAdministrationResponseDto,
} from "@shared/schemas/deployment/DeploymentPolicyAdministrationSchemaContracts";

export interface DeploymentPolicyWriteSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class DeploymentPolicyWriteSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<DeploymentPolicyWriteSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<DeploymentPolicyWriteSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "DeploymentPolicyWriteSchemaValidationError";
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
const OptionalTextSchema = z.string().trim().min(1).max(2048).optional();
const TicketReferenceSchema = z.string().trim().min(1).max(256).optional();
const CorrelationIdSchema = z.string().trim().min(1).max(128).optional();

const OverrideOperationSchema = z.object({
  operation: z.enum([
    DeploymentPolicyUpdateOperationKinds.upsert,
    DeploymentPolicyUpdateOperationKinds.remove,
  ]),
  familyId: IdentifierSchema,
  settingKey: IdentifierSchema,
  value: z.union([z.string(), z.number().finite(), z.boolean()]).optional(),
  valueType: z.enum([
    DeploymentPolicyValueKinds.string,
    DeploymentPolicyValueKinds.number,
    DeploymentPolicyValueKinds.boolean,
  ]).optional(),
  expectedControlMode: z.enum([
    DeploymentPolicyControlModes.profileFixed,
    DeploymentPolicyControlModes.profileDefaultAdminOverridable,
    DeploymentPolicyControlModes.runtimeAdmin,
  ]).optional(),
  provenance: z.object({
    ticketReference: TicketReferenceSchema,
    reason: OptionalTextSchema,
    updatedAt: TimestampSchema.optional(),
  }).strict().optional(),
}).strict().superRefine((value, context) => {
  if (value.operation === DeploymentPolicyUpdateOperationKinds.upsert && value.value === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "upsert operation requires value.",
    });
  }

  if (value.operation === DeploymentPolicyUpdateOperationKinds.remove && value.value !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["value"],
      message: "remove operation cannot include value.",
    });
  }

  if (value.valueType !== undefined && value.value !== undefined && typeof value.value !== value.valueType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["valueType"],
      message: "valueType must match value type.",
    });
  }
});

const UpdateActiveProfileRequestSchema: z.ZodType<UpdateDeploymentPolicyActiveProfileRequest> = z.object({
  profileId: ProfileIdSchema,
  dryRun: z.boolean().optional(),
  occurredAt: TimestampSchema.optional(),
  reason: OptionalTextSchema,
  ticketReference: TicketReferenceSchema,
  correlationId: CorrelationIdSchema,
  expectedRevision: z.number().int().min(0).optional(),
}).strict();

const ApplyOverridesRequestSchema: z.ZodType<ApplyDeploymentPolicyOverrideOperationsRequest> = z.object({
  profileId: ProfileIdSchema,
  operations: z.array(OverrideOperationSchema).min(1),
  dryRun: z.boolean().optional(),
  occurredAt: TimestampSchema.optional(),
  submittedAt: TimestampSchema.optional(),
  reason: OptionalTextSchema,
  ticketReference: TicketReferenceSchema,
  correlationId: CorrelationIdSchema,
  expectedRevision: z.number().int().min(0).optional(),
}).strict();

const ResponseEnvelopeSchema = z.object({
  result: z.object({
    scope: z.object({
      kind: z.literal(DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope),
      scopeId: IdentifierSchema,
    }).strict(),
    dryRun: z.boolean(),
    validation: z.unknown(),
    activeProfileSelection: z.object({
      record: z.object({
        scope: z.object({
          kind: z.literal(DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope),
          scopeId: IdentifierSchema,
        }).strict(),
        profileId: ProfileIdSchema,
        changedAt: TimestampSchema,
        changedByUserIdentityId: IdentifierSchema,
        reason: OptionalTextSchema,
        ticketReference: TicketReferenceSchema,
        createdAt: TimestampSchema,
        createdBy: IdentifierSchema,
        lastModifiedAt: TimestampSchema,
        lastModifiedBy: IdentifierSchema,
        revision: z.number().int().min(0),
      }).strict(),
      changed: z.boolean(),
      wasReplay: z.boolean(),
    }).strict().optional(),
    overrideMutations: z.array(z.object({
      operation: OverrideOperationSchema,
      changed: z.boolean(),
      wasReplay: z.boolean(),
      recordRevision: z.number().int().min(0),
    }).strict()),
    effectiveMetadata: z.object({
      record: z.object({
        scope: z.object({
          kind: z.literal(DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope),
          scopeId: IdentifierSchema,
        }).strict(),
        profileId: ProfileIdSchema,
        evaluatedAt: TimestampSchema,
        evaluationLayer: z.enum(["domain", "application"]),
        contractVersion: z.string().trim().min(1),
        familyCount: z.number().int().min(0),
        settingCount: z.number().int().min(0),
        sourceCounts: z.record(z.string(), z.number().int().min(0)),
        validation: z.unknown(),
        recordedAt: TimestampSchema,
        recordedByUserIdentityId: IdentifierSchema,
        revision: z.number().int().min(0),
      }).strict(),
      changed: z.boolean(),
      wasReplay: z.boolean(),
    }).strict().optional(),
    snapshot: z.unknown(),
  }).strict(),
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
    throw new DeploymentPolicyWriteSchemaValidationError(
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

function validateWriteResponsePayload(payload: unknown): void {
  const response = payload as { readonly result: { readonly snapshot: unknown; readonly validation: unknown; readonly effectiveMetadata?: { readonly record: { readonly validation: unknown } } } };
  parseDeploymentPolicyAdministrationSnapshot(response.result.snapshot);
  parseValidateDeploymentPolicyAdministrationResponseDto({
    validation: response.result.validation,
  });
  if (response.result.effectiveMetadata) {
    parseValidateDeploymentPolicyAdministrationResponseDto({
      validation: response.result.effectiveMetadata.record.validation,
    });
  }
}

export function parseUpdateDeploymentPolicyActiveProfileRequest(
  payload: unknown,
): UpdateDeploymentPolicyActiveProfileRequest {
  return parseSchema(
    "UpdateDeploymentPolicyActiveProfileRequest",
    UpdateActiveProfileRequestSchema,
    payload,
  );
}

export function parseApplyDeploymentPolicyOverrideOperationsRequest(
  payload: unknown,
): ApplyDeploymentPolicyOverrideOperationsRequest {
  return parseSchema(
    "ApplyDeploymentPolicyOverrideOperationsRequest",
    ApplyOverridesRequestSchema,
    payload,
  );
}

export function parseUpdateDeploymentPolicyActiveProfileResponse(
  payload: unknown,
): UpdateDeploymentPolicyActiveProfileResponse {
  const parsed = parseSchema(
    "UpdateDeploymentPolicyActiveProfileResponse",
    ResponseEnvelopeSchema,
    payload,
  );
  try {
    validateWriteResponsePayload(parsed);
  } catch (error) {
    throw new DeploymentPolicyWriteSchemaValidationError(
      "UpdateDeploymentPolicyActiveProfileResponse",
      [Object.freeze({
        path: "result",
        code: "custom",
        message: error instanceof Error ? error.message : "Deployment policy write response is invalid.",
      })],
    );
  }
  return parsed as UpdateDeploymentPolicyActiveProfileResponse;
}

export function parseApplyDeploymentPolicyOverrideOperationsResponse(
  payload: unknown,
): ApplyDeploymentPolicyOverrideOperationsResponse {
  const parsed = parseSchema(
    "ApplyDeploymentPolicyOverrideOperationsResponse",
    ResponseEnvelopeSchema,
    payload,
  );
  try {
    validateWriteResponsePayload(parsed);
  } catch (error) {
    throw new DeploymentPolicyWriteSchemaValidationError(
      "ApplyDeploymentPolicyOverrideOperationsResponse",
      [Object.freeze({
        path: "result",
        code: "custom",
        message: error instanceof Error ? error.message : "Deployment policy write response is invalid.",
      })],
    );
  }
  return parsed as ApplyDeploymentPolicyOverrideOperationsResponse;
}
