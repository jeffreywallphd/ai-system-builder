import {
  type DeploymentPolicyFamilyCatalog,
  type DeploymentPolicyFamilyId,
  type DeploymentPolicyScalarValue,
  type DeploymentPolicySettingKey,
  type DeploymentPolicySettingDefinition,
  type DeploymentProfileId,
  type DeploymentProfilePresetCatalog,
  isDeploymentPolicyAdminOverrideAllowed,
  resolveDeploymentProfilePresetPolicyValues,
  validateDeploymentPolicySettingValue,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyAdministrationContractVersions,
  type DeploymentPolicyAdminOverrideProvenance,
  type DeploymentPolicyAdministrationFamilySnapshot,
  type DeploymentPolicyAdministrationSnapshot,
  type DeploymentPolicyAdministrationState,
  type DeploymentPolicyAdministrationStateValues,
  type DeploymentPolicyResolvedSetting,
  DeploymentPolicyResolutionSources,
  DeploymentPolicyValidationIssueCodes,
  type DeploymentPolicyValidationOutcome,
  createDeploymentPolicyEffectiveSummary,
  createDeploymentPolicyProfilePresetMetadata,
  createDeploymentPolicyValidationOutcome,
  toDeploymentPolicyValueKind,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";

type SupportedEvaluationLayer = "domain" | "application";

export const DeploymentPolicyOverrideScopeKinds = Object.freeze({
  deploymentProfile: "deployment-profile",
} as const);

export type DeploymentPolicyOverrideScopeKind =
  typeof DeploymentPolicyOverrideScopeKinds[keyof typeof DeploymentPolicyOverrideScopeKinds];

export interface DeploymentPolicyOverrideScope {
  readonly kind: DeploymentPolicyOverrideScopeKind;
  readonly profileId: DeploymentProfileId;
}

export interface DeploymentPolicyAdminOverrideRecord {
  readonly profileId: DeploymentProfileId;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly value: DeploymentPolicyScalarValue;
  readonly overrideScope?: DeploymentPolicyOverrideScope;
  readonly provenance?: DeploymentPolicyAdminOverrideProvenance;
}

export interface DeploymentPolicyOverrideValidationResult {
  readonly state: DeploymentPolicyAdministrationState;
  readonly provenanceBySetting: Readonly<Record<string, DeploymentPolicyAdminOverrideProvenance>>;
  readonly validation: DeploymentPolicyValidationOutcome;
}

export interface DeploymentPolicyEffectiveResolutionResult {
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly normalizedAdminState: DeploymentPolicyAdministrationState;
}

function toSettingKey(input: { readonly familyId: string; readonly settingKey: string }): string {
  return `${input.familyId}.${input.settingKey}`;
}

function findSettingDefinition(input: {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
}): DeploymentPolicySettingDefinition | undefined {
  return input.familyCatalog[input.familyId]?.settings.find((setting) => setting.settingKey === input.settingKey);
}

function sortedAdminStateRecords(input: {
  readonly profileId: DeploymentProfileId;
  readonly state: DeploymentPolicyAdministrationState;
}): ReadonlyArray<DeploymentPolicyAdminOverrideRecord> {
  return Object.freeze(
    Object.entries(input.state.values)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([familyId, settings]) =>
        Object.entries(settings)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([settingKey, value]) =>
            Object.freeze({
              profileId: input.profileId,
              familyId,
              settingKey,
              value,
            })),
      ),
  );
}

export function validateDeploymentPolicyAdminOverrideRecords(input: {
  readonly profileId: DeploymentProfileId;
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly overrideRecords: ReadonlyArray<DeploymentPolicyAdminOverrideRecord>;
  readonly evaluatedAt?: string;
}): DeploymentPolicyOverrideValidationResult {
  const issues: NonNullable<DeploymentPolicyValidationOutcome["issues"]>[number][] = [];
  const stateValues: Record<string, Record<string, DeploymentPolicyScalarValue>> = {};
  const provenanceBySetting: Record<string, DeploymentPolicyAdminOverrideProvenance> = {};

  input.overrideRecords.forEach((record, index) => {
    const issuePathBase = `overrideRecords[${index}]`;
    const resolvedScope = record.overrideScope
      ?? Object.freeze({
        kind: DeploymentPolicyOverrideScopeKinds.deploymentProfile,
        profileId: record.profileId,
      });

    if (
      resolvedScope.kind !== DeploymentPolicyOverrideScopeKinds.deploymentProfile
      || resolvedScope.profileId !== input.profileId
      || record.profileId !== input.profileId
    ) {
      issues.push(Object.freeze({
        code: DeploymentPolicyValidationIssueCodes.overrideScopeMismatch,
        path: `${issuePathBase}.overrideScope`,
        familyId: record.familyId,
        settingKey: record.settingKey,
        message:
          `Override '${record.familyId}.${record.settingKey}' targets '${record.profileId}' and cannot be applied while resolving profile '${input.profileId}'.`,
      }));
      return;
    }

    const family = input.familyCatalog[record.familyId];
    if (!family) {
      issues.push(Object.freeze({
        code: DeploymentPolicyValidationIssueCodes.unknownFamily,
        path: `${issuePathBase}.familyId`,
        familyId: record.familyId,
        settingKey: record.settingKey,
        message: `Policy family '${record.familyId}' is not defined in the deployment policy catalog.`,
      }));
      return;
    }

    const settingDefinition = findSettingDefinition({
      familyCatalog: input.familyCatalog,
      familyId: record.familyId,
      settingKey: record.settingKey,
    });

    if (!settingDefinition) {
      issues.push(Object.freeze({
        code: DeploymentPolicyValidationIssueCodes.unknownSetting,
        path: `${issuePathBase}.settingKey`,
        familyId: record.familyId,
        settingKey: record.settingKey,
        message: `Policy setting '${record.familyId}.${record.settingKey}' is not defined in the deployment policy catalog.`,
      }));
      return;
    }

    if (!isDeploymentPolicyAdminOverrideAllowed(settingDefinition.controlMode)) {
      issues.push(Object.freeze({
        code: DeploymentPolicyValidationIssueCodes.profileFixedOverrideDenied,
        path: `${issuePathBase}.value`,
        familyId: record.familyId,
        settingKey: record.settingKey,
        message: `Policy setting '${record.familyId}.${record.settingKey}' is profile-fixed and cannot be overridden by admin state.`,
      }));
      return;
    }

    const validationIssues = validateDeploymentPolicySettingValue({
      settingDefinition,
      value: record.value,
    });
    if (validationIssues.length > 0) {
      issues.push(Object.freeze({
        code: DeploymentPolicyValidationIssueCodes.invalidValueKind,
        path: `${issuePathBase}.value`,
        familyId: record.familyId,
        settingKey: record.settingKey,
        expectedType: settingDefinition.valueKind,
        receivedType: typeof record.value,
        message: validationIssues[0]!.message,
      }));
      return;
    }

    const familyValues = stateValues[record.familyId] ?? {};
    familyValues[record.settingKey] = record.value;
    stateValues[record.familyId] = familyValues;

    if (record.provenance) {
      provenanceBySetting[toSettingKey({
        familyId: record.familyId,
        settingKey: record.settingKey,
      })] = Object.freeze({
        ...record.provenance,
      });
    }
  });

  const state: DeploymentPolicyAdministrationState = Object.freeze({
    values: Object.freeze(
      Object.fromEntries(
        Object.entries(stateValues).map(([familyId, settings]) => [familyId, Object.freeze({ ...settings })]),
      ) as DeploymentPolicyAdministrationStateValues,
    ),
  });

  const validation = createDeploymentPolicyValidationOutcome({
    issues,
    evaluatedAt: input.evaluatedAt,
  });

  return Object.freeze({
    state,
    provenanceBySetting: Object.freeze({ ...provenanceBySetting }),
    validation,
  });
}

export function resolveDeploymentPolicyEffectiveState(input: {
  readonly profileId: DeploymentProfileId;
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
  readonly evaluationLayer: SupportedEvaluationLayer;
  readonly evaluatedAt: string;
  readonly adminState?: DeploymentPolicyAdministrationState;
  readonly overrideRecords?: ReadonlyArray<DeploymentPolicyAdminOverrideRecord>;
}): DeploymentPolicyEffectiveResolutionResult {
  const overrideRecords = input.overrideRecords
    ?? (input.adminState ? sortedAdminStateRecords({
      profileId: input.profileId,
      state: input.adminState,
    }) : []);

  const overrideValidation = validateDeploymentPolicyAdminOverrideRecords({
    profileId: input.profileId,
    familyCatalog: input.familyCatalog,
    overrideRecords,
    evaluatedAt: input.evaluatedAt,
  });

  const presetValues = resolveDeploymentProfilePresetPolicyValues({
    profileId: input.profileId,
    presetCatalog: input.presetCatalog,
  });

  const familySnapshots: Record<string, DeploymentPolicyAdministrationFamilySnapshot> = {};
  for (const family of Object.values(input.familyCatalog)) {
    const settings: Record<string, DeploymentPolicyResolvedSetting> = {};
    const presetFamilyValues = presetValues[family.familyId] ?? {};
    const adminFamilyValues = overrideValidation.state.values[family.familyId] ?? {};

    for (const setting of family.settings) {
      const presetValue = presetFamilyValues[setting.settingKey];
      const hasPresetValue = presetValue !== undefined;

      let value: DeploymentPolicyScalarValue = hasPresetValue ? presetValue : setting.defaultValue;
      let source = hasPresetValue
        ? DeploymentPolicyResolutionSources.profilePreset
        : DeploymentPolicyResolutionSources.policyDefault;

      const adminValue = adminFamilyValues[setting.settingKey];
      if (adminValue !== undefined && isDeploymentPolicyAdminOverrideAllowed(setting.controlMode)) {
        value = adminValue;
        source = DeploymentPolicyResolutionSources.adminState;
      }

      const adminOverrideProvenance = source === DeploymentPolicyResolutionSources.adminState
        ? overrideValidation.provenanceBySetting[toSettingKey({
          familyId: family.familyId,
          settingKey: setting.settingKey,
        })]
        : undefined;

      settings[setting.settingKey] = Object.freeze({
        familyId: family.familyId,
        settingKey: setting.settingKey,
        controlMode: setting.controlMode,
        value,
        valueType: toDeploymentPolicyValueKind(value),
        source,
        adminOverrideProvenance,
      });
    }

    familySnapshots[family.familyId] = Object.freeze({
      familyId: family.familyId,
      settings: Object.freeze(settings),
    });
  }

  const families = Object.freeze(familySnapshots as Record<DeploymentPolicyFamilyId, DeploymentPolicyAdministrationFamilySnapshot>);
  const snapshot: DeploymentPolicyAdministrationSnapshot = Object.freeze({
    contractVersion: DeploymentPolicyAdministrationContractVersions.v1,
    profileId: input.profileId,
    evaluatedAt: input.evaluatedAt,
    evaluationLayer: input.evaluationLayer,
    preset: createDeploymentPolicyProfilePresetMetadata({
      profileId: input.profileId,
      presetCatalog: input.presetCatalog,
    }),
    families,
    summary: createDeploymentPolicyEffectiveSummary({
      families,
    }),
  });

  return Object.freeze({
    snapshot,
    validation: overrideValidation.validation,
    normalizedAdminState: overrideValidation.state,
  });
}
