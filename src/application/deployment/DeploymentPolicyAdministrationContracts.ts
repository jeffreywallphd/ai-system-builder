import {
  type DeploymentPolicyControlMode,
  DeploymentPolicyControlModes,
  type DeploymentPolicyFamilyCatalog,
  type DeploymentPolicyFamilyId,
  type DeploymentPolicyScalarValue,
  type DeploymentPolicySettingKey,
  type DeploymentProfileId,
  type DeploymentProfilePresetCatalog,
  isDeploymentPolicyAdminOverrideAllowed,
  resolveDeploymentPolicySettingDefinition,
  validateDeploymentPolicySettingValue,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  type DeploymentPolicyAdministrationFamilySnapshot,
  type DeploymentPolicyAdministrationSnapshot,
  type DeploymentPolicyAdministrationState,
  type DeploymentPolicyAdministrationStateValues,
  type DeploymentPolicyResolvedSetting,
  type DeploymentPolicyResolutionSource,
  DeploymentPolicyResolutionSources,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  type DeploymentPolicyAdminOverrideRecord,
  resolveDeploymentPolicyEffectiveState,
  validateDeploymentPolicyAdminOverrideRecords,
} from "./DeploymentPolicyEffectiveResolutionService";

export class DeploymentPolicyAdministrationContractsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentPolicyAdministrationContractsError";
  }
}

export const DeploymentPolicyEvaluationRequestLayers = Object.freeze({
  domain: "domain",
  application: "application",
  infrastructure: "infrastructure",
  transport: "transport",
  ui: "ui",
});

export type DeploymentPolicyEvaluationRequestLayer =
  typeof DeploymentPolicyEvaluationRequestLayers[keyof typeof DeploymentPolicyEvaluationRequestLayers];

function normalizeTimestamp(value: string | Date | undefined): string {
  const candidate = value instanceof Date ? value.toISOString() : value?.trim() ?? new Date().toISOString();
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new DeploymentPolicyAdministrationContractsError(
      `Policy snapshot evaluatedAt '${candidate}' must be a valid ISO timestamp.`,
    );
  }
  return parsed.toISOString();
}

function assertEvaluationLayer(layer: DeploymentPolicyEvaluationRequestLayer): "domain" | "application" {
  if (
    layer === DeploymentPolicyEvaluationRequestLayers.domain
    || layer === DeploymentPolicyEvaluationRequestLayers.application
  ) {
    return layer;
  }
  throw new DeploymentPolicyAdministrationContractsError(
    `Policy evaluation is not permitted from '${layer}'. Use domain/application policy seams instead of UI, transport, or infrastructure adapters.`,
  );
}

export function createDeploymentPolicyAdministrationState(input: {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly values?: DeploymentPolicyAdministrationStateValues;
}): DeploymentPolicyAdministrationState {
  const normalized: Record<string, Readonly<Record<string, DeploymentPolicyScalarValue>>> = {};

  for (const [familyId, settings] of Object.entries(input.values ?? {})) {
    const familyValues: Record<string, DeploymentPolicyScalarValue> = {};
    for (const [settingKey, value] of Object.entries(settings)) {
      const settingDefinition = resolveDeploymentPolicySettingDefinition({
        familyCatalog: input.familyCatalog,
        familyId,
        settingKey,
      });
      if (!isDeploymentPolicyAdminOverrideAllowed(settingDefinition.controlMode)) {
        throw new DeploymentPolicyAdministrationContractsError(
          `Policy setting '${familyId}.${settingKey}' is '${DeploymentPolicyControlModes.profileFixed}' and cannot be overridden by runtime admin state.`,
        );
      }
      const validationIssues = validateDeploymentPolicySettingValue({
        settingDefinition,
        value,
      });
      if (validationIssues.length > 0) {
        throw new DeploymentPolicyAdministrationContractsError(
          `Policy setting '${familyId}.${settingKey}' is invalid: ${validationIssues[0]!.message}`,
        );
      }
      familyValues[settingKey] = value;
    }
    normalized[familyId] = Object.freeze(familyValues);
  }

  return Object.freeze({
    values: Object.freeze(normalized),
  });
}

export function evaluateDeploymentPolicyAdministrationSnapshot(input: {
  readonly profileId: DeploymentProfileId;
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
  readonly adminState?: DeploymentPolicyAdministrationState;
  readonly evaluationLayer: DeploymentPolicyEvaluationRequestLayer;
  readonly evaluatedAt?: string | Date;
}): DeploymentPolicyAdministrationSnapshot {
  const evaluationLayer = assertEvaluationLayer(input.evaluationLayer);
  const evaluatedAt = normalizeTimestamp(input.evaluatedAt);
  return resolveDeploymentPolicyEffectiveState({
    profileId: input.profileId,
    familyCatalog: input.familyCatalog,
    presetCatalog: input.presetCatalog,
    adminState: input.adminState,
    evaluationLayer,
    evaluatedAt,
  }).snapshot;
}

export function resolveDeploymentPolicyAdministrationSnapshotWithOverrides(input: {
  readonly profileId: DeploymentProfileId;
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
  readonly overrideRecords: ReadonlyArray<DeploymentPolicyAdminOverrideRecord>;
  readonly evaluationLayer: DeploymentPolicyEvaluationRequestLayer;
  readonly evaluatedAt?: string | Date;
}): ReturnType<typeof resolveDeploymentPolicyEffectiveState> {
  const evaluationLayer = assertEvaluationLayer(input.evaluationLayer);
  const evaluatedAt = normalizeTimestamp(input.evaluatedAt);
  return resolveDeploymentPolicyEffectiveState({
    profileId: input.profileId,
    familyCatalog: input.familyCatalog,
    presetCatalog: input.presetCatalog,
    overrideRecords: input.overrideRecords,
    evaluationLayer,
    evaluatedAt,
  });
}

export type {
  DeploymentPolicyAdministrationFamilySnapshot,
  DeploymentPolicyAdministrationSnapshot,
  DeploymentPolicyAdministrationState,
  DeploymentPolicyAdministrationStateValues,
  DeploymentPolicyResolvedSetting,
  DeploymentPolicyResolutionSource,
};
export { DeploymentPolicyResolutionSources };

export type {
  DeploymentPolicyControlMode,
  DeploymentPolicyFamilyId,
  DeploymentPolicySettingKey,
};
export type { DeploymentPolicyAdminOverrideRecord };
export { validateDeploymentPolicyAdminOverrideRecords };
