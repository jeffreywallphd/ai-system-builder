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
  resolveDeploymentProfilePresetPolicyValues,
  validateDeploymentPolicySettingValue,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyAdministrationContractVersions,
  type DeploymentPolicyAdministrationFamilySnapshot,
  type DeploymentPolicyAdministrationSnapshot,
  type DeploymentPolicyAdministrationState,
  type DeploymentPolicyAdministrationStateValues,
  type DeploymentPolicyResolvedSetting,
  type DeploymentPolicyResolutionSource,
  DeploymentPolicyResolutionSources,
  createDeploymentPolicyEffectiveSummary,
  createDeploymentPolicyProfilePresetMetadata,
  toDeploymentPolicyValueKind,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";

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
  const presetValues = resolveDeploymentProfilePresetPolicyValues({
    profileId: input.profileId,
    presetCatalog: input.presetCatalog,
  });

  const familySnapshots: Record<string, DeploymentPolicyAdministrationFamilySnapshot> = {};
  for (const family of Object.values(input.familyCatalog)) {
    const settings: Record<string, DeploymentPolicyResolvedSetting> = {};
    const presetFamilyValues = presetValues[family.familyId] ?? {};
    const adminFamilyValues = input.adminState?.values[family.familyId] ?? {};

    for (const setting of family.settings) {
      const presetValue = presetFamilyValues[setting.settingKey];
      const hasPresetValue = presetValue !== undefined;
      let value: DeploymentPolicyScalarValue = hasPresetValue ? presetValue : setting.defaultValue;
      let source: DeploymentPolicyResolutionSource = hasPresetValue
        ? DeploymentPolicyResolutionSources.profilePreset
        : DeploymentPolicyResolutionSources.policyDefault;

      const adminValue = adminFamilyValues[setting.settingKey];
      if (adminValue !== undefined && isDeploymentPolicyAdminOverrideAllowed(setting.controlMode)) {
        value = adminValue;
        source = DeploymentPolicyResolutionSources.adminState;
      }

      settings[setting.settingKey] = Object.freeze({
        familyId: family.familyId,
        settingKey: setting.settingKey,
        controlMode: setting.controlMode,
        value,
        valueType: toDeploymentPolicyValueKind(value),
        source,
      });
    }

    familySnapshots[family.familyId] = Object.freeze({
      familyId: family.familyId,
      settings: Object.freeze(settings),
    });
  }

  const families = Object.freeze(familySnapshots as Record<DeploymentPolicyFamilyId, DeploymentPolicyAdministrationFamilySnapshot>);

  return Object.freeze({
    contractVersion: DeploymentPolicyAdministrationContractVersions.v1,
    profileId: input.profileId,
    evaluatedAt,
    evaluationLayer,
    preset: createDeploymentPolicyProfilePresetMetadata({
      profileId: input.profileId,
      presetCatalog: input.presetCatalog,
    }),
    families,
    summary: createDeploymentPolicyEffectiveSummary({
      families,
    }),
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
