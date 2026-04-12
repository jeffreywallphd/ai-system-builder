import type {
  DeploymentPolicyControlMode,
  DeploymentPolicyFamilyCatalog,
  DeploymentPolicyFamilyId,
  DeploymentPolicyScalarValue,
  DeploymentPolicySettingKey,
  DeploymentProfileId,
  DeploymentProfilePresetCatalog,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyControlModes,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";

export class DeploymentPolicyAdministrationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentPolicyAdministrationContractError";
  }
}

export const DeploymentPolicyAdministrationContractVersions = Object.freeze({
  v1: "deployment-policy-administration/v1",
} as const);

export type DeploymentPolicyAdministrationContractVersion =
  typeof DeploymentPolicyAdministrationContractVersions[keyof typeof DeploymentPolicyAdministrationContractVersions];

export const DeploymentPolicyValueKinds = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
} as const);

export type DeploymentPolicyValueKind = typeof DeploymentPolicyValueKinds[keyof typeof DeploymentPolicyValueKinds];

export const DeploymentPolicyResolutionSources = Object.freeze({
  profilePreset: "profile-preset",
  policyDefault: "policy-default",
  adminState: "admin-state",
} as const);

export type DeploymentPolicyResolutionSource =
  typeof DeploymentPolicyResolutionSources[keyof typeof DeploymentPolicyResolutionSources];

export const DeploymentPolicyValidationIssueCodes = Object.freeze({
  unknownFamily: "unknown-family",
  unknownSetting: "unknown-setting",
  overrideScopeMismatch: "override-scope-mismatch",
  profileFixedOverrideDenied: "profile-fixed-override-denied",
  runtimeAdminPresetOverrideDenied: "runtime-admin-preset-override-denied",
  invalidScalarType: "invalid-scalar-type",
  invalidValueKind: "invalid-value-kind",
  invalidUpdateOperation: "invalid-update-operation",
} as const);

export type DeploymentPolicyValidationIssueCode =
  typeof DeploymentPolicyValidationIssueCodes[keyof typeof DeploymentPolicyValidationIssueCodes];

export const DeploymentPolicyUpdateOperationKinds = Object.freeze({
  upsert: "upsert",
  remove: "remove",
} as const);

export type DeploymentPolicyUpdateOperationKind =
  typeof DeploymentPolicyUpdateOperationKinds[keyof typeof DeploymentPolicyUpdateOperationKinds];

export interface DeploymentPolicyTypedValue {
  readonly kind: DeploymentPolicyValueKind;
  readonly value: DeploymentPolicyScalarValue;
}

export interface DeploymentPolicyAdminOverrideProvenance {
  readonly actorUserIdentityId?: string;
  readonly ticketReference?: string;
  readonly reason?: string;
  readonly updatedAt?: string;
}

export interface DeploymentPolicyResolvedSetting {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly controlMode: DeploymentPolicyControlMode;
  readonly value: DeploymentPolicyScalarValue;
  readonly valueType: DeploymentPolicyValueKind;
  readonly source: DeploymentPolicyResolutionSource;
  readonly adminOverrideProvenance?: DeploymentPolicyAdminOverrideProvenance;
}

export interface DeploymentPolicyAdministrationFamilySnapshot {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settings: Readonly<Record<DeploymentPolicySettingKey, DeploymentPolicyResolvedSetting>>;
}

export interface DeploymentPolicyProfilePresetMetadata {
  readonly profileId: DeploymentProfileId;
  readonly parentProfileId?: DeploymentProfileId;
  readonly lineage: ReadonlyArray<DeploymentProfileId>;
  readonly inheritedFrom: ReadonlyArray<DeploymentProfileId>;
}

export interface DeploymentPolicyEffectiveSummary {
  readonly familyCount: number;
  readonly settingCount: number;
  readonly sourceCounts: Readonly<Record<DeploymentPolicyResolutionSource, number>>;
  readonly controlModeCounts: Readonly<Record<DeploymentPolicyControlMode, number>>;
}

export interface DeploymentPolicyAdministrationSnapshot {
  readonly contractVersion: DeploymentPolicyAdministrationContractVersion;
  readonly profileId: DeploymentProfileId;
  readonly evaluatedAt: string;
  readonly evaluationLayer: "domain" | "application";
  readonly preset: DeploymentPolicyProfilePresetMetadata;
  readonly families: Readonly<Record<DeploymentPolicyFamilyId, DeploymentPolicyAdministrationFamilySnapshot>>;
  readonly summary: DeploymentPolicyEffectiveSummary;
}

export type DeploymentPolicyAdministrationStateValues =
  Readonly<Record<DeploymentPolicyFamilyId, Readonly<Record<DeploymentPolicySettingKey, DeploymentPolicyScalarValue>>>>;

export interface DeploymentPolicyAdministrationState {
  readonly values: DeploymentPolicyAdministrationStateValues;
}

export interface DeploymentPolicyValidationIssue {
  readonly code: DeploymentPolicyValidationIssueCode;
  readonly message: string;
  readonly path: string;
  readonly familyId?: DeploymentPolicyFamilyId;
  readonly settingKey?: DeploymentPolicySettingKey;
  readonly expectedType?: DeploymentPolicyValueKind;
  readonly receivedType?: string;
}

export interface DeploymentPolicyValidationOutcome {
  readonly valid: boolean;
  readonly issues: ReadonlyArray<DeploymentPolicyValidationIssue>;
  readonly evaluatedAt: string;
}

export interface DeploymentPolicyUpdateOperation {
  readonly operation: DeploymentPolicyUpdateOperationKind;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly value?: DeploymentPolicyScalarValue;
  readonly valueType?: DeploymentPolicyValueKind;
  readonly expectedControlMode?: DeploymentPolicyControlMode;
  readonly provenance?: DeploymentPolicyAdminOverrideProvenance;
}

export interface DeploymentPolicyAdminUpdateCommand {
  readonly profileId: DeploymentProfileId;
  readonly actorUserIdentityId: string;
  readonly submittedAt?: string;
  readonly expectedRevision?: number;
  readonly dryRun?: boolean;
  readonly operations: ReadonlyArray<DeploymentPolicyUpdateOperation>;
}

export interface ReadDeploymentPolicyAdministrationRequest {
  readonly profileId: DeploymentProfileId;
  readonly includeCatalog?: boolean;
  readonly includeValidation?: boolean;
  readonly asOf?: string;
}

export interface ReadDeploymentPolicyAdministrationResponse {
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation?: DeploymentPolicyValidationOutcome;
}

export interface ValidateDeploymentPolicyAdministrationRequest {
  readonly profileId: DeploymentProfileId;
  readonly currentState?: DeploymentPolicyAdministrationState;
  readonly command?: DeploymentPolicyAdminUpdateCommand;
}

export interface ValidateDeploymentPolicyAdministrationResponse {
  readonly validation: DeploymentPolicyValidationOutcome;
}

export interface UpdateDeploymentPolicyAdministrationRequest {
  readonly command: DeploymentPolicyAdminUpdateCommand;
}

export interface UpdateDeploymentPolicyAdministrationResponse {
  readonly applied: boolean;
  readonly profileId: DeploymentProfileId;
  readonly newRevision: number;
  readonly snapshot?: DeploymentPolicyAdministrationSnapshot;
  readonly validation: DeploymentPolicyValidationOutcome;
}

export function toDeploymentPolicyValueKind(value: DeploymentPolicyScalarValue): DeploymentPolicyValueKind {
  const scalarType = typeof value;
  if (scalarType === DeploymentPolicyValueKinds.string) {
    return DeploymentPolicyValueKinds.string;
  }
  if (scalarType === DeploymentPolicyValueKinds.number) {
    return DeploymentPolicyValueKinds.number;
  }
  if (scalarType === DeploymentPolicyValueKinds.boolean) {
    return DeploymentPolicyValueKinds.boolean;
  }

  throw new DeploymentPolicyAdministrationContractError(
    `Unsupported deployment policy scalar value type '${scalarType}'.`,
  );
}

export function toDeploymentPolicyTypedValue(value: DeploymentPolicyScalarValue): DeploymentPolicyTypedValue {
  return Object.freeze({
    kind: toDeploymentPolicyValueKind(value),
    value,
  });
}

export function createDeploymentPolicyProfilePresetMetadata(input: {
  readonly profileId: DeploymentProfileId;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
}): DeploymentPolicyProfilePresetMetadata {
  const preset = input.presetCatalog[input.profileId];
  if (!preset) {
    throw new DeploymentPolicyAdministrationContractError(
      `Deployment profile preset '${input.profileId}' is not available in preset catalog.`,
    );
  }

  const lineage: DeploymentProfileId[] = [];
  let current: DeploymentProfileId | undefined = input.profileId;
  while (current) {
    lineage.unshift(current);
    current = input.presetCatalog[current]?.parentProfileId;
  }

  return Object.freeze({
    profileId: input.profileId,
    parentProfileId: preset.parentProfileId,
    lineage: Object.freeze(lineage),
    inheritedFrom: Object.freeze(lineage.filter((profileId) => profileId !== input.profileId)),
  });
}

export function createDeploymentPolicyEffectiveSummary(input: {
  readonly families: Readonly<Record<DeploymentPolicyFamilyId, DeploymentPolicyAdministrationFamilySnapshot>>;
}): DeploymentPolicyEffectiveSummary {
  const sourceCounts: Record<DeploymentPolicyResolutionSource, number> = {
    [DeploymentPolicyResolutionSources.profilePreset]: 0,
    [DeploymentPolicyResolutionSources.policyDefault]: 0,
    [DeploymentPolicyResolutionSources.adminState]: 0,
  };

  const controlModeCounts: Record<DeploymentPolicyControlMode, number> = {
    [DeploymentPolicyControlModes.profileFixed]: 0,
    [DeploymentPolicyControlModes.profileDefaultAdminOverridable]: 0,
    [DeploymentPolicyControlModes.runtimeAdmin]: 0,
  };

  let settingCount = 0;
  for (const family of Object.values(input.families)) {
    for (const setting of Object.values(family.settings)) {
      settingCount += 1;
      sourceCounts[setting.source] += 1;
      controlModeCounts[setting.controlMode] += 1;
    }
  }

  return Object.freeze({
    familyCount: Object.keys(input.families).length,
    settingCount,
    sourceCounts: Object.freeze(sourceCounts),
    controlModeCounts: Object.freeze(controlModeCounts),
  });
}

export function createDeploymentPolicyValidationOutcome(input: {
  readonly issues?: ReadonlyArray<DeploymentPolicyValidationIssue>;
  readonly evaluatedAt?: string;
}): DeploymentPolicyValidationOutcome {
  const issues = Object.freeze([...(input.issues ?? [])]);
  return Object.freeze({
    valid: issues.length === 0,
    issues,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
  });
}

export function createDeploymentPolicyCatalogShape(input: {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
}): Readonly<Record<DeploymentPolicyFamilyId, ReadonlyArray<DeploymentPolicySettingKey>>> {
  const entries = Object.values(input.familyCatalog).map((family) => [
    family.familyId,
    Object.freeze(family.settings.map((setting) => setting.settingKey)),
  ] as const);

  return Object.freeze(Object.fromEntries(entries));
}
