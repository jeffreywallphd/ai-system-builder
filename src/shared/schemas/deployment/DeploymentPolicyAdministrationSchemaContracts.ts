import { z } from "zod";
import {
  DeploymentProfileIds,
  DeploymentPolicyControlModes,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyAdministrationContractVersions,
  DeploymentPolicyResolutionSources,
  DeploymentPolicyUpdateOperationKinds,
  DeploymentPolicyValidationIssueCodes,
  DeploymentPolicyValueKinds,
  type DeploymentPolicyAdministrationFamilySnapshot,
  type DeploymentPolicyAdministrationSnapshot,
  type DeploymentPolicyAdministrationState,
  type DeploymentPolicyAdminUpdateCommand,
  type DeploymentPolicyResolvedSetting,
  type DeploymentPolicyValidationOutcome,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  PatchDeploymentPolicyAdministrationStateRequestDto,
  PatchDeploymentPolicyAdministrationStateResponseDto,
  ReadDeploymentPolicyAdministrationRequestDto,
  ReadDeploymentPolicyAdministrationResponseDto,
  UpdateDeploymentPolicyAdministrationRequestDto,
  UpdateDeploymentPolicyAdministrationResponseDto,
  ValidateDeploymentPolicyAdministrationRequestDto,
  ValidateDeploymentPolicyAdministrationResponseDto,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationDtos";

export interface DeploymentPolicyAdministrationSchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

export class DeploymentPolicyAdministrationSchemaValidationError extends Error {
  public readonly schemaName: string;
  public readonly issues: ReadonlyArray<DeploymentPolicyAdministrationSchemaValidationIssue>;

  constructor(schemaName: string, issues: ReadonlyArray<DeploymentPolicyAdministrationSchemaValidationIssue>) {
    const summary = issues.length > 0
      ? issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")
      : "Unknown validation failure.";
    super(`${schemaName} payload is invalid: ${summary}`);
    this.name = "DeploymentPolicyAdministrationSchemaValidationError";
    this.schemaName = schemaName;
    this.issues = issues;
  }
}

const IdentifierSchema = z.string().trim().min(1).max(256)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,255}$/, "Identifier format is invalid.");

const TimestampSchema = z.string().trim().datetime({ offset: true });

const DeploymentProfileIdSchema = z.enum([
  DeploymentProfileIds.home,
  DeploymentProfileIds.classroom,
  DeploymentProfileIds.organization,
]);

const DeploymentPolicyValueKindSchema = z.enum([
  DeploymentPolicyValueKinds.string,
  DeploymentPolicyValueKinds.number,
  DeploymentPolicyValueKinds.boolean,
]);

const DeploymentPolicyControlModeSchema = z.enum([
  DeploymentPolicyControlModes.profileFixed,
  DeploymentPolicyControlModes.profileDefaultAdminOverridable,
  DeploymentPolicyControlModes.runtimeAdmin,
]);

const DeploymentPolicyResolutionSourceSchema = z.enum([
  DeploymentPolicyResolutionSources.profilePreset,
  DeploymentPolicyResolutionSources.policyDefault,
  DeploymentPolicyResolutionSources.adminState,
]);

const DeploymentPolicyValidationIssueCodeSchema = z.enum([
  DeploymentPolicyValidationIssueCodes.unknownFamily,
  DeploymentPolicyValidationIssueCodes.unknownSetting,
  DeploymentPolicyValidationIssueCodes.overrideScopeMismatch,
  DeploymentPolicyValidationIssueCodes.profileFixedOverrideDenied,
  DeploymentPolicyValidationIssueCodes.runtimeAdminPresetOverrideDenied,
  DeploymentPolicyValidationIssueCodes.invalidScalarType,
  DeploymentPolicyValidationIssueCodes.invalidValueKind,
  DeploymentPolicyValidationIssueCodes.invalidUpdateOperation,
]);

const DeploymentPolicyScalarValueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
]);

const DeploymentPolicyAdminOverrideProvenanceSchema = z.object({
  actorUserIdentityId: IdentifierSchema.optional(),
  ticketReference: z.string().trim().min(1).max(256).optional(),
  reason: z.string().trim().min(1).max(2048).optional(),
  updatedAt: TimestampSchema.optional(),
}).strict();

const DeploymentPolicyResolvedSettingSchema: z.ZodType<DeploymentPolicyResolvedSetting> = z.object({
  familyId: IdentifierSchema,
  settingKey: IdentifierSchema,
  controlMode: DeploymentPolicyControlModeSchema,
  value: DeploymentPolicyScalarValueSchema,
  valueType: DeploymentPolicyValueKindSchema,
  source: DeploymentPolicyResolutionSourceSchema,
  adminOverrideProvenance: DeploymentPolicyAdminOverrideProvenanceSchema.optional(),
}).strict().superRefine((value, context) => {
  const actualType = typeof value.value;
  if (actualType !== value.valueType) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["valueType"],
      message: `valueType '${value.valueType}' must match value type '${actualType}'.`,
    });
  }

  if (value.source !== DeploymentPolicyResolutionSources.adminState && value.adminOverrideProvenance) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["adminOverrideProvenance"],
      message: "adminOverrideProvenance is only valid when source='admin-state'.",
    });
  }
});

const DeploymentPolicyAdministrationFamilySnapshotSchema: z.ZodType<DeploymentPolicyAdministrationFamilySnapshot> =
  z.object({
    familyId: IdentifierSchema,
    settings: z.record(IdentifierSchema, DeploymentPolicyResolvedSettingSchema),
  }).strict().superRefine((value, context) => {
    for (const [settingKey, setting] of Object.entries(value.settings)) {
      if (setting.settingKey !== settingKey) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["settings", settingKey, "settingKey"],
          message: `Setting key '${setting.settingKey}' must match settings map key '${settingKey}'.`,
        });
      }

      if (setting.familyId !== value.familyId) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["settings", settingKey, "familyId"],
          message: `Setting family '${setting.familyId}' must match family snapshot id '${value.familyId}'.`,
        });
      }
    }
  });

const DeploymentPolicyProfilePresetMetadataSchema = z.object({
  profileId: DeploymentProfileIdSchema,
  parentProfileId: DeploymentProfileIdSchema.optional(),
  lineage: z.array(DeploymentProfileIdSchema).min(1),
  inheritedFrom: z.array(DeploymentProfileIdSchema),
}).strict().superRefine((value, context) => {
  const last = value.lineage[value.lineage.length - 1];
  if (last !== value.profileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["lineage"],
      message: "lineage must terminate with profileId.",
    });
  }
});

const DeploymentPolicyEffectiveSummarySchema = z.object({
  familyCount: z.number().int().min(0),
  settingCount: z.number().int().min(0),
  sourceCounts: z.record(DeploymentPolicyResolutionSourceSchema, z.number().int().min(0)),
  controlModeCounts: z.record(DeploymentPolicyControlModeSchema, z.number().int().min(0)),
}).strict().superRefine((value, context) => {
  const totalBySource = Object.values(value.sourceCounts).reduce((sum, count) => sum + count, 0);
  if (totalBySource !== value.settingCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourceCounts"],
      message: "sourceCounts total must equal settingCount.",
    });
  }

  const totalByControlMode = Object.values(value.controlModeCounts).reduce((sum, count) => sum + count, 0);
  if (totalByControlMode !== value.settingCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["controlModeCounts"],
      message: "controlModeCounts total must equal settingCount.",
    });
  }
});

const DeploymentPolicyAdministrationSnapshotSchema: z.ZodType<DeploymentPolicyAdministrationSnapshot> = z.object({
  contractVersion: z.literal(DeploymentPolicyAdministrationContractVersions.v1),
  profileId: DeploymentProfileIdSchema,
  evaluatedAt: TimestampSchema,
  evaluationLayer: z.enum(["domain", "application"]),
  preset: DeploymentPolicyProfilePresetMetadataSchema,
  families: z.record(IdentifierSchema, DeploymentPolicyAdministrationFamilySnapshotSchema),
  summary: DeploymentPolicyEffectiveSummarySchema,
}).strict().superRefine((value, context) => {
  if (value.preset.profileId !== value.profileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["preset", "profileId"],
      message: "preset.profileId must match snapshot.profileId.",
    });
  }

  if (Object.keys(value.families).length !== value.summary.familyCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["summary", "familyCount"],
      message: "summary.familyCount must equal families map size.",
    });
  }
});

const DeploymentPolicyAdministrationStateSchema: z.ZodType<DeploymentPolicyAdministrationState> = z.object({
  values: z.record(IdentifierSchema, z.record(IdentifierSchema, DeploymentPolicyScalarValueSchema)),
}).strict();

const DeploymentPolicyValidationIssueSchema = z.object({
  code: DeploymentPolicyValidationIssueCodeSchema,
  message: z.string().trim().min(1).max(2048),
  path: z.string().trim().min(1).max(512),
  familyId: IdentifierSchema.optional(),
  settingKey: IdentifierSchema.optional(),
  expectedType: DeploymentPolicyValueKindSchema.optional(),
  receivedType: z.string().trim().min(1).max(64).optional(),
}).strict();

const DeploymentPolicyValidationOutcomeSchema: z.ZodType<DeploymentPolicyValidationOutcome> = z.object({
  valid: z.boolean(),
  issues: z.array(DeploymentPolicyValidationIssueSchema),
  evaluatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
  if (value.valid && value.issues.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["valid"],
      message: "valid=true requires issues to be empty.",
    });
  }

  if (!value.valid && value.issues.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["issues"],
      message: "valid=false requires at least one issue.",
    });
  }
});

const DeploymentPolicyUpdateOperationSchema = z.object({
  operation: z.enum([
    DeploymentPolicyUpdateOperationKinds.upsert,
    DeploymentPolicyUpdateOperationKinds.remove,
  ]),
  familyId: IdentifierSchema,
  settingKey: IdentifierSchema,
  value: DeploymentPolicyScalarValueSchema.optional(),
  valueType: DeploymentPolicyValueKindSchema.optional(),
  expectedControlMode: DeploymentPolicyControlModeSchema.optional(),
  provenance: DeploymentPolicyAdminOverrideProvenanceSchema.optional(),
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

const DeploymentPolicyAdminUpdateCommandSchema: z.ZodType<DeploymentPolicyAdminUpdateCommand> = z.object({
  profileId: DeploymentProfileIdSchema,
  actorUserIdentityId: IdentifierSchema,
  submittedAt: TimestampSchema.optional(),
  expectedRevision: z.number().int().min(0).optional(),
  dryRun: z.boolean().optional(),
  operations: z.array(DeploymentPolicyUpdateOperationSchema).min(1),
}).strict();

export const ReadDeploymentPolicyAdministrationRequestDtoSchema: z.ZodType<
  ReadDeploymentPolicyAdministrationRequestDto
> = z.object({
  profileId: DeploymentProfileIdSchema,
  includeCatalog: z.boolean().optional(),
  includeValidation: z.boolean().optional(),
  asOf: TimestampSchema.optional(),
}).strict();

export const ReadDeploymentPolicyAdministrationResponseDtoSchema: z.ZodType<
  ReadDeploymentPolicyAdministrationResponseDto
> = z.object({
  snapshot: DeploymentPolicyAdministrationSnapshotSchema,
  validation: DeploymentPolicyValidationOutcomeSchema.optional(),
}).strict();

export const ValidateDeploymentPolicyAdministrationRequestDtoSchema: z.ZodType<
  ValidateDeploymentPolicyAdministrationRequestDto
> = z.object({
  profileId: DeploymentProfileIdSchema,
  currentState: DeploymentPolicyAdministrationStateSchema.optional(),
  command: DeploymentPolicyAdminUpdateCommandSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.command && value.command.profileId !== value.profileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["command", "profileId"],
      message: "command.profileId must match request.profileId.",
    });
  }
});

export const ValidateDeploymentPolicyAdministrationResponseDtoSchema: z.ZodType<
  ValidateDeploymentPolicyAdministrationResponseDto
> = z.object({
  validation: DeploymentPolicyValidationOutcomeSchema,
}).strict();

export const UpdateDeploymentPolicyAdministrationRequestDtoSchema: z.ZodType<
  UpdateDeploymentPolicyAdministrationRequestDto
> = z.object({
  command: DeploymentPolicyAdminUpdateCommandSchema,
}).strict();

export const UpdateDeploymentPolicyAdministrationResponseDtoSchema: z.ZodType<
  UpdateDeploymentPolicyAdministrationResponseDto
> = z.object({
  applied: z.boolean(),
  profileId: DeploymentProfileIdSchema,
  newRevision: z.number().int().min(0),
  snapshot: DeploymentPolicyAdministrationSnapshotSchema.optional(),
  validation: DeploymentPolicyValidationOutcomeSchema,
}).strict().superRefine((value, context) => {
  if (value.snapshot && value.snapshot.profileId !== value.profileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["snapshot", "profileId"],
      message: "snapshot.profileId must match profileId.",
    });
  }
});

export const PatchDeploymentPolicyAdministrationStateRequestDtoSchema: z.ZodType<
  PatchDeploymentPolicyAdministrationStateRequestDto
> = z.object({
  profileId: DeploymentProfileIdSchema,
  actorUserIdentityId: IdentifierSchema,
  submittedAt: TimestampSchema.optional(),
  expectedRevision: z.number().int().min(0).optional(),
  state: DeploymentPolicyAdministrationStateSchema,
}).strict();

export const PatchDeploymentPolicyAdministrationStateResponseDtoSchema: z.ZodType<
  PatchDeploymentPolicyAdministrationStateResponseDto
> = z.object({
  profileId: DeploymentProfileIdSchema,
  snapshot: DeploymentPolicyAdministrationSnapshotSchema,
  validation: DeploymentPolicyValidationOutcomeSchema,
  newRevision: z.number().int().min(0),
}).strict().superRefine((value, context) => {
  if (value.snapshot.profileId !== value.profileId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["snapshot", "profileId"],
      message: "snapshot.profileId must match profileId.",
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

function parseDeploymentPolicySchema<T>(schemaName: string, schema: z.ZodSchema<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new DeploymentPolicyAdministrationSchemaValidationError(
      schemaName,
      parsed.error.issues.map((issue) => ({
        path: formatZodPath(issue.path),
        message: issue.message,
        code: issue.code,
      })),
    );
  }

  return parsed.data;
}

export type DeploymentPolicyAdministrationSnapshotPayload = z.infer<typeof DeploymentPolicyAdministrationSnapshotSchema>;
export type DeploymentPolicyAdminUpdateCommandPayload = z.infer<typeof DeploymentPolicyAdminUpdateCommandSchema>;

export function parseDeploymentPolicyAdministrationSnapshot(
  payload: unknown,
): DeploymentPolicyAdministrationSnapshotPayload {
  return parseDeploymentPolicySchema(
    "DeploymentPolicyAdministrationSnapshot",
    DeploymentPolicyAdministrationSnapshotSchema,
    payload,
  );
}

export function parseDeploymentPolicyAdminUpdateCommand(payload: unknown): DeploymentPolicyAdminUpdateCommandPayload {
  return parseDeploymentPolicySchema(
    "DeploymentPolicyAdminUpdateCommand",
    DeploymentPolicyAdminUpdateCommandSchema,
    payload,
  );
}

export function parseReadDeploymentPolicyAdministrationRequestDto(
  payload: unknown,
): ReadDeploymentPolicyAdministrationRequestDto {
  return parseDeploymentPolicySchema(
    "ReadDeploymentPolicyAdministrationRequestDto",
    ReadDeploymentPolicyAdministrationRequestDtoSchema,
    payload,
  );
}

export function parseReadDeploymentPolicyAdministrationResponseDto(
  payload: unknown,
): ReadDeploymentPolicyAdministrationResponseDto {
  return parseDeploymentPolicySchema(
    "ReadDeploymentPolicyAdministrationResponseDto",
    ReadDeploymentPolicyAdministrationResponseDtoSchema,
    payload,
  );
}

export function parseValidateDeploymentPolicyAdministrationRequestDto(
  payload: unknown,
): ValidateDeploymentPolicyAdministrationRequestDto {
  return parseDeploymentPolicySchema(
    "ValidateDeploymentPolicyAdministrationRequestDto",
    ValidateDeploymentPolicyAdministrationRequestDtoSchema,
    payload,
  );
}

export function parseValidateDeploymentPolicyAdministrationResponseDto(
  payload: unknown,
): ValidateDeploymentPolicyAdministrationResponseDto {
  return parseDeploymentPolicySchema(
    "ValidateDeploymentPolicyAdministrationResponseDto",
    ValidateDeploymentPolicyAdministrationResponseDtoSchema,
    payload,
  );
}

export function parseUpdateDeploymentPolicyAdministrationRequestDto(
  payload: unknown,
): UpdateDeploymentPolicyAdministrationRequestDto {
  return parseDeploymentPolicySchema(
    "UpdateDeploymentPolicyAdministrationRequestDto",
    UpdateDeploymentPolicyAdministrationRequestDtoSchema,
    payload,
  );
}

export function parseUpdateDeploymentPolicyAdministrationResponseDto(
  payload: unknown,
): UpdateDeploymentPolicyAdministrationResponseDto {
  return parseDeploymentPolicySchema(
    "UpdateDeploymentPolicyAdministrationResponseDto",
    UpdateDeploymentPolicyAdministrationResponseDtoSchema,
    payload,
  );
}

export function parsePatchDeploymentPolicyAdministrationStateRequestDto(
  payload: unknown,
): PatchDeploymentPolicyAdministrationStateRequestDto {
  return parseDeploymentPolicySchema(
    "PatchDeploymentPolicyAdministrationStateRequestDto",
    PatchDeploymentPolicyAdministrationStateRequestDtoSchema,
    payload,
  );
}

export function parsePatchDeploymentPolicyAdministrationStateResponseDto(
  payload: unknown,
): PatchDeploymentPolicyAdministrationStateResponseDto {
  return parseDeploymentPolicySchema(
    "PatchDeploymentPolicyAdministrationStateResponseDto",
    PatchDeploymentPolicyAdministrationStateResponseDtoSchema,
    payload,
  );
}
