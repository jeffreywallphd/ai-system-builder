
export class DeploymentProfilePolicyAdministrationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeploymentProfilePolicyAdministrationDomainError";
  }
}

export const DeploymentProfileIds = Object.freeze({
  home: "home",
  classroom: "classroom",
  organization: "organization",
});

export type DeploymentProfileId = typeof DeploymentProfileIds[keyof typeof DeploymentProfileIds];

export const DeploymentPolicyControlModes = Object.freeze({
  profileFixed: "profile-fixed",
  profileDefaultAdminOverridable: "profile-default-admin-overridable",
  runtimeAdmin: "runtime-admin",
});

export type DeploymentPolicyControlMode =
  typeof DeploymentPolicyControlModes[keyof typeof DeploymentPolicyControlModes];

export const DeploymentPolicyFamilyScopes = Object.freeze({
  deploymentProfile: "deployment-profile",
  runSubmission: "run-submission",
  sharing: "sharing",
  storage: "storage",
  security: "security",
  administration: "administration",
  audit: "audit",
});

export type DeploymentPolicyFamilyScope =
  typeof DeploymentPolicyFamilyScopes[keyof typeof DeploymentPolicyFamilyScopes];

export const DeploymentPolicyValueKinds = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
});

export type DeploymentPolicyValueKind =
  typeof DeploymentPolicyValueKinds[keyof typeof DeploymentPolicyValueKinds];

export const DeploymentPolicyGovernanceSensitivityLevels = Object.freeze({
  standard: "standard",
  governanceSensitive: "governance-sensitive",
  foundational: "foundational",
});

export type DeploymentPolicyGovernanceSensitivityLevel =
  typeof DeploymentPolicyGovernanceSensitivityLevels[keyof typeof DeploymentPolicyGovernanceSensitivityLevels];

export interface DeploymentPolicyControlledFeatureArea {
  readonly areaId: string;
  readonly label: string;
  readonly currentBehavior: string;
}

export interface DeploymentPolicyExplainabilityDefinition {
  readonly behaviorSummary: string;
  readonly governedFeatureAreas: ReadonlyArray<DeploymentPolicyControlledFeatureArea>;
  readonly governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevel;
  readonly governanceWarning?: string;
}

export interface DeploymentPolicySettingEnumRule {
  readonly type: "enum";
  readonly allowedValues: ReadonlyArray<string>;
}

export interface DeploymentPolicySettingNumberRangeRule {
  readonly type: "number-range";
  readonly min: number;
  readonly max: number;
  readonly integerOnly?: boolean;
}

export type DeploymentPolicySettingValidationRule =
  | DeploymentPolicySettingEnumRule
  | DeploymentPolicySettingNumberRangeRule;

export interface DeploymentPolicyValueValidationIssue {
  readonly code: "invalid-type" | "disallowed-value" | "out-of-range" | "non-integer";
  readonly message: string;
}

export type DeploymentPolicyScalarValue = string | number | boolean;
export type DeploymentPolicyFamilyId = string;
export type DeploymentPolicySettingKey = string;

export interface DeploymentPolicySettingDefinition {
  readonly settingKey: DeploymentPolicySettingKey;
  readonly description: string;
  readonly controlMode: DeploymentPolicyControlMode;
  readonly defaultValue: DeploymentPolicyScalarValue;
  readonly valueKind?: DeploymentPolicyValueKind;
  readonly validationRules?: ReadonlyArray<DeploymentPolicySettingValidationRule>;
}

export interface DeploymentPolicyFamilyDefinition {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly description: string;
  readonly settings: ReadonlyArray<DeploymentPolicySettingDefinition>;
  readonly scope?: DeploymentPolicyFamilyScope;
  readonly explainability?: DeploymentPolicyExplainabilityDefinition;
}

export type DeploymentPolicyFamilyCatalog =
  Readonly<Record<DeploymentPolicyFamilyId, DeploymentPolicyFamilyDefinition>>;

export type DeploymentPolicyFamilySettingValues =
  Readonly<Record<DeploymentPolicySettingKey, DeploymentPolicyScalarValue>>;

export type DeploymentProfilePolicyValues =
  Readonly<Record<DeploymentPolicyFamilyId, DeploymentPolicyFamilySettingValues>>;

export interface DeploymentProfilePolicyPreset {
  readonly profileId: DeploymentProfileId;
  readonly parentProfileId?: DeploymentProfileId;
  readonly policyOverrides: DeploymentProfilePolicyValues;
}

export type DeploymentProfilePresetCatalog = Readonly<Record<DeploymentProfileId, DeploymentProfilePolicyPreset>>;

export interface DeploymentProfilePresetDefinition {
  readonly profileId: DeploymentProfileId;
  readonly parentProfileId?: DeploymentProfileId;
  readonly scope: string;
  readonly rationale: string;
  readonly policyOverrides: DeploymentProfilePolicyValues;
}

export type DeploymentProfilePresetDefinitionCatalog =
  Readonly<Record<DeploymentProfileId, DeploymentProfilePresetDefinition>>;

export interface DeploymentPolicyConfigurationRegistry {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
  readonly profileDefaults: Readonly<Record<DeploymentProfileId, DeploymentProfilePolicyValues>>;
}

export const DeploymentPolicyFamilyIds = Object.freeze({
  approvalGovernance: "approval-governance",
  sharingPosture: "sharing-posture",
  storageGovernance: "storage-governance",
  securityGovernance: "security-governance",
  adminControls: "admin-controls",
  auditGovernance: "audit-governance",
});

const CanonicalProfileIds = new Set<DeploymentProfileId>(Object.values(DeploymentProfileIds));
const CanonicalFamilyScopes = new Set<DeploymentPolicyFamilyScope>(Object.values(DeploymentPolicyFamilyScopes));
const CanonicalValueKinds = new Set<DeploymentPolicyValueKind>(Object.values(DeploymentPolicyValueKinds));
const CanonicalGovernanceSensitivityLevels = new Set<DeploymentPolicyGovernanceSensitivityLevel>(
  Object.values(DeploymentPolicyGovernanceSensitivityLevels),
);
const PolicyFamilyIdPattern = /^[a-z][a-z0-9-]{2,126}$/;
const PolicySettingKeyPattern = /^[a-z][a-zA-Z0-9]{2,126}$/;
const ExplainabilityAreaIdPattern = /^[a-z][a-z0-9-]{2,126}$/;

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new DeploymentProfilePolicyAdministrationDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function scalarType(value: DeploymentPolicyScalarValue): DeploymentPolicyValueKind {
  return typeof value as DeploymentPolicyValueKind;
}

function assertControlMode(value: DeploymentPolicyControlMode): DeploymentPolicyControlMode {
  if (!Object.values(DeploymentPolicyControlModes).includes(value)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy control mode '${String(value)}' is invalid.`,
    );
  }
  return value;
}

function assertProfileId(value: string): DeploymentProfileId {
  const normalized = normalizeRequired(value, "Deployment profile id").toLowerCase();
  if (!CanonicalProfileIds.has(normalized as DeploymentProfileId)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment profile '${normalized}' is unsupported. Supported profiles: ${Object.values(DeploymentProfileIds).join(", ")}.`,
    );
  }
  return normalized as DeploymentProfileId;
}

function normalizeValueKind(
  valueKind: DeploymentPolicyValueKind | undefined,
  defaultValue: DeploymentPolicyScalarValue,
  settingKey: string,
): DeploymentPolicyValueKind {
  const inferred = scalarType(defaultValue);
  const normalized = valueKind ?? inferred;
  if (!CanonicalValueKinds.has(normalized)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy setting '${settingKey}' has invalid valueKind '${String(normalized)}'.`,
    );
  }
  if (normalized !== inferred) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy setting '${settingKey}' valueKind '${normalized}' does not match default value type '${inferred}'.`,
    );
  }
  return normalized;
}
function normalizeValidationRules(
  input: ReadonlyArray<DeploymentPolicySettingValidationRule> | undefined,
  valueKind: DeploymentPolicyValueKind,
  settingKey: string,
): ReadonlyArray<DeploymentPolicySettingValidationRule> {
  const normalizedRules: DeploymentPolicySettingValidationRule[] = [];
  for (const rule of input ?? []) {
    if (rule.type === "enum") {
      if (valueKind !== DeploymentPolicyValueKinds.string) {
        throw new DeploymentProfilePolicyAdministrationDomainError(
          `Deployment policy setting '${settingKey}' cannot use enum validation for valueKind '${valueKind}'.`,
        );
      }
      const allowed = [
        ...new Set(
          rule.allowedValues.map((entry) =>
            normalizeRequired(entry, `Allowed enum value for setting '${settingKey}'`),
          ),
        ),
      ];
      if (allowed.length < 1) {
        throw new DeploymentProfilePolicyAdministrationDomainError(
          `Deployment policy setting '${settingKey}' enum validation must declare at least one allowed value.`,
        );
      }
      normalizedRules.push(
        Object.freeze({
          type: "enum",
          allowedValues: Object.freeze(allowed),
        }),
      );
      continue;
    }

    if (valueKind !== DeploymentPolicyValueKinds.number) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment policy setting '${settingKey}' cannot use number-range validation for valueKind '${valueKind}'.`,
      );
    }
    if (!Number.isFinite(rule.min) || !Number.isFinite(rule.max)) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment policy setting '${settingKey}' number-range validation requires finite min and max values.`,
      );
    }
    if (rule.min > rule.max) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment policy setting '${settingKey}' number-range validation requires min <= max.`,
      );
    }
    normalizedRules.push(
      Object.freeze({
        type: "number-range",
        min: rule.min,
        max: rule.max,
        integerOnly: rule.integerOnly ?? false,
      }),
    );
  }
  return Object.freeze(normalizedRules);
}

function normalizeFamilyScope(scope: DeploymentPolicyFamilyScope | undefined): DeploymentPolicyFamilyScope {
  const normalized = scope ?? DeploymentPolicyFamilyScopes.deploymentProfile;
  if (!CanonicalFamilyScopes.has(normalized)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy family scope '${String(normalized)}' is invalid.`,
    );
  }
  return normalized;
}

function normalizeExplainabilityDefinition(
  input: DeploymentPolicyExplainabilityDefinition | undefined,
  familyId: string,
): DeploymentPolicyExplainabilityDefinition | undefined {
  if (!input) {
    return undefined;
  }

  const behaviorSummary = normalizeRequired(
    input.behaviorSummary,
    `Deployment policy family '${familyId}' explainability behavior summary`,
  );
  if (!CanonicalGovernanceSensitivityLevels.has(input.governanceSensitivity)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy family '${familyId}' has invalid governance sensitivity '${String(input.governanceSensitivity)}'.`,
    );
  }

  const governedFeatureAreas: DeploymentPolicyControlledFeatureArea[] = [];
  for (const area of input.governedFeatureAreas) {
    const areaId = normalizeRequired(area.areaId, `Policy family '${familyId}' explainability area id`).toLowerCase();
    if (!ExplainabilityAreaIdPattern.test(areaId)) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment policy family '${familyId}' explainability area id '${areaId}' is invalid.`,
      );
    }
    governedFeatureAreas.push(Object.freeze({
      areaId,
      label: normalizeRequired(area.label, `Policy family '${familyId}' explainability area label`),
      currentBehavior: normalizeRequired(
        area.currentBehavior,
        `Policy family '${familyId}' explainability area '${areaId}' behavior summary`,
      ),
    }));
  }
  if (governedFeatureAreas.length < 1) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy family '${familyId}' explainability must include at least one governed feature area.`,
    );
  }

  return Object.freeze({
    behaviorSummary,
    governedFeatureAreas: Object.freeze(governedFeatureAreas),
    governanceSensitivity: input.governanceSensitivity,
    governanceWarning: normalizeOptional(input.governanceWarning),
  });
}

export function normalizeDeploymentProfileId(value: string): DeploymentProfileId {
  const normalized = normalizeRequired(value, "Deployment profile id").toLowerCase();
  if (normalized.startsWith("deployment-profile:")) {
    return normalizeDeploymentProfileId(normalized.slice("deployment-profile:".length));
  }
  return assertProfileId(normalized);
}

export function validateDeploymentPolicySettingValue(input: {
  readonly settingDefinition: DeploymentPolicySettingDefinition;
  readonly value: DeploymentPolicyScalarValue;
}): ReadonlyArray<DeploymentPolicyValueValidationIssue> {
  const issues: DeploymentPolicyValueValidationIssue[] = [];

  const actualKind = scalarType(input.value);
  if (actualKind !== input.settingDefinition.valueKind) {
    issues.push({
      code: "invalid-type",
      message: `Policy setting '${input.settingDefinition.settingKey}' expects '${input.settingDefinition.valueKind}' values.`,
    });
    return Object.freeze(issues);
  }

  for (const rule of input.settingDefinition.validationRules ?? []) {
    if (rule.type === "enum") {
      if (!rule.allowedValues.includes(input.value as string)) {
        issues.push({
          code: "disallowed-value",
          message: `Policy setting '${input.settingDefinition.settingKey}' value '${String(input.value)}' is not allowed.`,
        });
      }
      continue;
    }

    const numericValue = input.value as number;
    if (rule.integerOnly && !Number.isInteger(numericValue)) {
      issues.push({
        code: "non-integer",
        message: `Policy setting '${input.settingDefinition.settingKey}' requires an integer value.`,
      });
      continue;
    }
    if (numericValue < rule.min || numericValue > rule.max) {
      issues.push({
        code: "out-of-range",
        message: `Policy setting '${input.settingDefinition.settingKey}' value '${numericValue}' must be between ${rule.min} and ${rule.max}.`,
      });
    }
  }

  return Object.freeze(issues);
}

function normalizeSettingDefinition(input: DeploymentPolicySettingDefinition): DeploymentPolicySettingDefinition {
  const settingKey = normalizeRequired(input.settingKey, "Deployment policy setting key");
  if (!PolicySettingKeyPattern.test(settingKey)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy setting key '${settingKey}' must start with a letter and use alphanumeric camel-case characters.`,
    );
  }

  const valueKind = normalizeValueKind(input.valueKind, input.defaultValue, settingKey);
  const validationRules = normalizeValidationRules(input.validationRules, valueKind, settingKey);

  const normalized: DeploymentPolicySettingDefinition = Object.freeze({
    settingKey,
    description: normalizeRequired(input.description, `Deployment policy setting '${settingKey}' description`),
    controlMode: assertControlMode(input.controlMode),
    defaultValue: input.defaultValue,
    valueKind,
    validationRules,
  });

  const defaultIssues = validateDeploymentPolicySettingValue({
    settingDefinition: normalized,
    value: normalized.defaultValue,
  });
  if (defaultIssues.length > 0) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy setting '${settingKey}' default value is invalid: ${defaultIssues[0]!.message}`,
    );
  }

  return normalized;
}

function normalizeFamilyDefinition(input: DeploymentPolicyFamilyDefinition): DeploymentPolicyFamilyDefinition {
  const familyId = normalizeRequired(input.familyId, "Deployment policy family id").toLowerCase();
  if (!PolicyFamilyIdPattern.test(familyId)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy family id '${familyId}' must start with a letter and use lowercase alphanumeric '-' characters.`,
    );
  }

  const bySetting = new Map<DeploymentPolicySettingKey, DeploymentPolicySettingDefinition>();
  for (const setting of input.settings) {
    const normalizedSetting = normalizeSettingDefinition(setting);
    if (bySetting.has(normalizedSetting.settingKey)) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment policy family '${familyId}' contains duplicate setting '${normalizedSetting.settingKey}'.`,
      );
    }
    bySetting.set(normalizedSetting.settingKey, normalizedSetting);
  }
  if (bySetting.size < 1) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy family '${familyId}' must declare at least one setting.`,
    );
  }

  return Object.freeze({
    familyId,
    scope: normalizeFamilyScope(input.scope),
    description: normalizeRequired(input.description, `Deployment policy family '${familyId}' description`),
    settings: Object.freeze([...bySetting.values()]),
    explainability: normalizeExplainabilityDefinition(input.explainability, familyId),
  });
}

function normalizeFamilySettingValues(input: {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly values: Readonly<Record<string, DeploymentPolicyScalarValue>>;
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly allowRuntimeAdmin: boolean;
}): DeploymentPolicyFamilySettingValues {
  const family = input.familyCatalog[input.familyId];
  if (!family) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Policy family '${input.familyId}' is not defined in the family catalog.`,
    );
  }

  const settingMap = new Map<DeploymentPolicySettingKey, DeploymentPolicySettingDefinition>();
  for (const setting of family.settings) {
    settingMap.set(setting.settingKey, setting);
  }

  const normalized: Record<string, DeploymentPolicyScalarValue> = {};
  for (const [rawKey, rawValue] of Object.entries(input.values)) {
    const settingKey = normalizeRequired(rawKey, `Policy setting key for family '${input.familyId}'`);
    const settingDefinition = settingMap.get(settingKey);
    if (!settingDefinition) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Policy setting '${settingKey}' is not defined in family '${input.familyId}'.`,
      );
    }
    if (!input.allowRuntimeAdmin && settingDefinition.controlMode === DeploymentPolicyControlModes.runtimeAdmin) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Preset policy family '${input.familyId}' cannot override runtime-admin setting '${settingKey}'.`,
      );
    }

    const issues = validateDeploymentPolicySettingValue({
      settingDefinition,
      value: rawValue,
    });
    if (issues.length > 0) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Policy setting '${input.familyId}.${settingKey}' is invalid: ${issues[0]!.message}`,
      );
    }

    normalized[settingKey] = rawValue;
  }

  return Object.freeze(normalized);
}

function assertPresetCatalogIsAcyclic(catalog: DeploymentProfilePresetCatalog): void {
  const visiting = new Set<DeploymentProfileId>();
  const visited = new Set<DeploymentProfileId>();

  function visit(profileId: DeploymentProfileId): void {
    if (visited.has(profileId)) {
      return;
    }
    if (visiting.has(profileId)) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment profile preset inheritance contains a cycle at '${profileId}'.`,
      );
    }
    visiting.add(profileId);
    const parentId = catalog[profileId].parentProfileId;
    if (parentId) {
      visit(parentId);
    }
    visiting.delete(profileId);
    visited.add(profileId);
  }

  for (const profileId of Object.values(DeploymentProfileIds)) {
    visit(profileId);
  }
}

export function createDeploymentPolicyFamilyCatalog(
  definitions: ReadonlyArray<DeploymentPolicyFamilyDefinition>,
): DeploymentPolicyFamilyCatalog {
  const byFamily: Record<string, DeploymentPolicyFamilyDefinition> = {};
  for (const definition of definitions) {
    const normalized = normalizeFamilyDefinition(definition);
    if (byFamily[normalized.familyId]) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment policy family '${normalized.familyId}' is defined more than once.`,
      );
    }
    byFamily[normalized.familyId] = normalized;
  }
  if (Object.keys(byFamily).length < 1) {
    throw new DeploymentProfilePolicyAdministrationDomainError("At least one deployment policy family is required.");
  }
  return Object.freeze(byFamily);
}

export function createDeploymentProfilePresetCatalog(input: {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly presets: ReadonlyArray<{
    readonly profileId: string;
    readonly parentProfileId?: string;
    readonly policyOverrides?: Readonly<Record<string, Readonly<Record<string, DeploymentPolicyScalarValue>>>>;
  }>;
}): DeploymentProfilePresetCatalog {
  const byProfile: Partial<Record<DeploymentProfileId, DeploymentProfilePolicyPreset>> = {};

  for (const preset of input.presets) {
    const profileId = assertProfileId(preset.profileId);
    if (byProfile[profileId]) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment profile preset '${profileId}' is defined more than once.`,
      );
    }

    const parentProfileId = normalizeOptional(preset.parentProfileId)
      ? assertProfileId(preset.parentProfileId!)
      : undefined;
    if (parentProfileId && parentProfileId === profileId) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment profile '${profileId}' cannot inherit from itself.`,
      );
    }

    const normalizedPolicyOverrides: Record<string, DeploymentPolicyFamilySettingValues> = {};
    for (const [familyIdRaw, values] of Object.entries(preset.policyOverrides ?? {})) {
      const familyId = normalizeRequired(
        familyIdRaw,
        `Policy family id for deployment profile '${profileId}'`,
      ).toLowerCase();
      normalizedPolicyOverrides[familyId] = normalizeFamilySettingValues({
        familyId,
        values,
        familyCatalog: input.familyCatalog,
        allowRuntimeAdmin: false,
      });
    }

    byProfile[profileId] = Object.freeze({
      profileId,
      parentProfileId,
      policyOverrides: Object.freeze(normalizedPolicyOverrides),
    });
  }

  for (const profileId of Object.values(DeploymentProfileIds)) {
    if (!byProfile[profileId]) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Deployment profile preset '${profileId}' is required in the preset catalog.`,
      );
    }
  }

  const catalog = Object.freeze(byProfile as Record<DeploymentProfileId, DeploymentProfilePolicyPreset>);
  assertPresetCatalogIsAcyclic(catalog);
  return catalog;
}

export function resolveDeploymentProfilePresetPolicyValues(input: {
  readonly profileId: DeploymentProfileId;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
}): DeploymentProfilePolicyValues {
  const lineage: DeploymentProfileId[] = [];
  let current: DeploymentProfileId | undefined = input.profileId;
  while (current) {
    lineage.unshift(current);
    current = input.presetCatalog[current]?.parentProfileId;
  }

  const merged: Record<string, Record<string, DeploymentPolicyScalarValue>> = {};
  for (const profileId of lineage) {
    const profile = input.presetCatalog[profileId];
    for (const [familyId, settings] of Object.entries(profile.policyOverrides)) {
      const existing = merged[familyId] ?? {};
      merged[familyId] = {
        ...existing,
        ...settings,
      };
    }
  }

  const frozen: Record<string, DeploymentPolicyFamilySettingValues> = {};
  for (const [familyId, settings] of Object.entries(merged)) {
    frozen[familyId] = Object.freeze({ ...settings });
  }
  return Object.freeze(frozen);
}

export function resolveDeploymentPolicySettingDefinition(input: {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
}): DeploymentPolicySettingDefinition {
  const family = input.familyCatalog[input.familyId];
  if (!family) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Policy family '${input.familyId}' is not defined in the family catalog.`,
    );
  }
  const setting = family.settings.find((entry) => entry.settingKey === input.settingKey);
  if (!setting) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Policy setting '${input.familyId}.${input.settingKey}' is not defined in the family catalog.`,
    );
  }
  return setting;
}

export function createDeploymentPolicyConfigurationRegistry(input: {
  readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog: DeploymentProfilePresetCatalog;
}): DeploymentPolicyConfigurationRegistry {
  const profileDefaults: Record<DeploymentProfileId, DeploymentProfilePolicyValues> = {
    [DeploymentProfileIds.home]: resolveDeploymentProfilePresetPolicyValues({
      profileId: DeploymentProfileIds.home,
      presetCatalog: input.presetCatalog,
    }),
    [DeploymentProfileIds.classroom]: resolveDeploymentProfilePresetPolicyValues({
      profileId: DeploymentProfileIds.classroom,
      presetCatalog: input.presetCatalog,
    }),
    [DeploymentProfileIds.organization]: resolveDeploymentProfilePresetPolicyValues({
      profileId: DeploymentProfileIds.organization,
      presetCatalog: input.presetCatalog,
    }),
  };

  return Object.freeze({
    familyCatalog: input.familyCatalog,
    presetCatalog: input.presetCatalog,
    profileDefaults: Object.freeze(profileDefaults),
  });
}

export function isDeploymentPolicyAdminOverrideAllowed(controlMode: DeploymentPolicyControlMode): boolean {
  return controlMode === DeploymentPolicyControlModes.profileDefaultAdminOverridable
    || controlMode === DeploymentPolicyControlModes.runtimeAdmin;
}

export function createCanonicalDeploymentPolicyFamilyCatalog(): DeploymentPolicyFamilyCatalog {
  return createDeploymentPolicyFamilyCatalog([
    {
      familyId: DeploymentPolicyFamilyIds.approvalGovernance,
      scope: DeploymentPolicyFamilyScopes.runSubmission,
      description: "Run and workflow approval strictness, escalation posture, and privileged action governance.",
      explainability: {
        behaviorSummary:
          "Currently drives run-submission approval defaults and escalation timing exposed by deployment scheduling policy evaluation seams.",
        governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevels.governanceSensitive,
        governanceWarning:
          "Approval-governance settings influence submission-control posture; review changes with operational governance owners.",
        governedFeatureAreas: [
          {
            areaId: "run-submission-policy-evaluation",
            label: "Run submission policy decisions",
            currentBehavior:
              "Scheduling policy evaluation returns approval mode, high-risk dual-approval, and escalation timeout settings from this family.",
          },
          {
            areaId: "run-submission-validation",
            label: "Run submission validation",
            currentBehavior:
              "Run-submission validation workflows consume scheduling policy decisions to enforce approval prerequisites.",
          },
        ],
      },
      settings: [
        {
          settingKey: "runSubmissionApprovalMode",
          description: "Default run-submission approval strategy for the deployment profile.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: "owner-or-admin",
          valueKind: DeploymentPolicyValueKinds.string,
          validationRules: [{
            type: "enum",
            allowedValues: ["self-or-owner", "owner-or-instructor", "owner-or-admin", "owner-with-manual-review"],
          }],
        },
        {
          settingKey: "highRiskRunRequiresDualApproval",
          description: "Whether high-risk run classes require dual-approval workflow.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "approvalEscalationTimeoutMinutes",
          description: "Escalation timeout for unresolved approval requests.",
          controlMode: DeploymentPolicyControlModes.runtimeAdmin,
          defaultValue: 120,
          valueKind: DeploymentPolicyValueKinds.number,
          validationRules: [{
            type: "number-range",
            min: 5,
            max: 10080,
            integerOnly: true,
          }],
        },
      ],
    },
    {
      familyId: DeploymentPolicyFamilyIds.sharingPosture,
      scope: DeploymentPolicyFamilyScopes.sharing,
      description: "Default resource visibility and sharing constraints for collaborative surfaces.",
      explainability: {
        behaviorSummary:
          "Currently controls workspace visibility defaults and sharing-approval posture returned by deployment authorization policy evaluation seams.",
        governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevels.governanceSensitive,
        governanceWarning:
          "Sharing-posture settings can broaden or restrict collaboration exposure; confirm intended data-sharing boundaries before applying overrides.",
        governedFeatureAreas: [
          {
            areaId: "workspace-creation-default-visibility",
            label: "Workspace default visibility",
            currentBehavior:
              "Workspace-creation flows resolve default visibility from this family through deployment authorization policy decisions.",
          },
          {
            areaId: "sharing-policy-evaluation",
            label: "Sharing policy decisions",
            currentBehavior:
              "Authorization policy evaluation exposes public-link and cross-workspace sharing constraints from this family.",
          },
        ],
      },
      settings: [
        {
          settingKey: "defaultWorkspaceVisibility",
          description: "Default visibility for newly published workspace resources.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: "workspace",
          valueKind: DeploymentPolicyValueKinds.string,
          validationRules: [{
            type: "enum",
            allowedValues: ["private", "workspace", "organization"],
          }],
        },
        {
          settingKey: "publicLinkSharingAllowed",
          description: "Whether public-link sharing is allowed in the deployment profile.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: false,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "crossWorkspaceShareRequiresApproval",
          description: "Whether cross-workspace sharing requires explicit approval.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
      ],
    },
    {
      familyId: DeploymentPolicyFamilyIds.storageGovernance,
      scope: DeploymentPolicyFamilyScopes.storage,
      description: "Storage defaults, synchronization posture, and retention controls.",
      explainability: {
        behaviorSummary:
          "Currently controls storage-tier defaults, external-sync default posture, and retention defaults exposed by deployment storage policy evaluation seams.",
        governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevels.standard,
        governedFeatureAreas: [
          {
            areaId: "storage-policy-evaluation",
            label: "Storage policy decisions",
            currentBehavior:
              "Storage policy evaluation returns default storage tier, external sync default, and retention defaults from this family.",
          },
          {
            areaId: "policy-admin-overrides",
            label: "Policy override administration",
            currentBehavior:
              "Deployment policy admin write workflows can upsert or remove supported storage-governance override values.",
          },
        ],
      },
      settings: [
        {
          settingKey: "defaultStorageTier",
          description: "Default storage tier for new workspace storage allocations.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: "server-managed",
          valueKind: DeploymentPolicyValueKinds.string,
          validationRules: [{
            type: "enum",
            allowedValues: ["local-managed", "workspace-managed", "server-managed"],
          }],
        },
        {
          settingKey: "externalSyncEnabledByDefault",
          description: "Whether external synchronization is enabled by profile default.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: false,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "retentionDaysDefault",
          description: "Default retention period for governed storage surfaces.",
          controlMode: DeploymentPolicyControlModes.runtimeAdmin,
          defaultValue: 90,
          valueKind: DeploymentPolicyValueKinds.number,
          validationRules: [{
            type: "number-range",
            min: 7,
            max: 3650,
            integerOnly: true,
          }],
        },
      ],
    },
    {
      familyId: DeploymentPolicyFamilyIds.securityGovernance,
      scope: DeploymentPolicyFamilyScopes.security,
      description: "Security baseline controls for transport, encryption, and credential rotation posture.",
      explainability: {
        behaviorSummary:
          "Currently defines encryption-at-rest, transport TLS, and credential-rotation settings exposed by deployment security policy evaluation seams.",
        governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevels.foundational,
        governanceWarning:
          "Security-governance settings are foundational controls. Changes should follow formal security review and change-management procedures.",
        governedFeatureAreas: [
          {
            areaId: "security-policy-evaluation",
            label: "Security policy decisions",
            currentBehavior:
              "Security policy evaluation exposes encryption-at-rest, TLS-required, and credential-rotation settings from this family.",
          },
          {
            areaId: "policy-inspection-surfaces",
            label: "Policy administration inspection",
            currentBehavior:
              "Admin policy inspection surfaces display source and effective values for security-governance controls and their provenance.",
          },
        ],
      },
      settings: [
        {
          settingKey: "encryptionAtRestRequired",
          description: "Whether encryption at rest is mandatory.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "transportTlsRequired",
          description: "Whether TLS is mandatory for non-loopback runtime transport.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "localCredentialRotationDays",
          description: "Credential rotation window used by policy reminders and checks.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: 90,
          valueKind: DeploymentPolicyValueKinds.number,
          validationRules: [{
            type: "number-range",
            min: 30,
            max: 365,
            integerOnly: true,
          }],
        },
      ],
    },
    {
      familyId: DeploymentPolicyFamilyIds.adminControls,
      scope: DeploymentPolicyFamilyScopes.administration,
      description: "Administrative delegation and policy-mutation governance controls.",
      explainability: {
        behaviorSummary:
          "Currently governs admin workflow safety posture, including delegated-admin policy flags, ticket-reference requirements, and dry-run defaults.",
        governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevels.foundational,
        governanceWarning:
          "Admin-controls settings govern policy change safety and traceability; unauthorized relaxation can weaken governance controls across the workspace.",
        governedFeatureAreas: [
          {
            areaId: "policy-write-governance",
            label: "Policy write workflow requirements",
            currentBehavior:
              "Policy write workflows enforce ticket-reference and dry-run behavior based on this family's effective settings.",
          },
          {
            areaId: "authorization-policy-decisions",
            label: "Authorization policy decisions",
            currentBehavior:
              "Deployment authorization policy evaluation includes delegated workspace admin allowance from this family.",
          },
        ],
      },
      settings: [
        {
          settingKey: "allowDelegatedWorkspaceAdmins",
          description: "Whether delegated workspace administrators are allowed.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "policyChangeRequiresTicketReference",
          description: "Whether policy changes require external ticket/change-reference attribution.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "policyDryRunModeEnabledByDefault",
          description: "Whether dry-run mode is enabled by default in policy administration workflows.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
      ],
    },
    {
      familyId: DeploymentPolicyFamilyIds.auditGovernance,
      scope: DeploymentPolicyFamilyScopes.audit,
      description: "Audit event posture, redaction strictness, and retention administration settings.",
      explainability: {
        behaviorSummary:
          "Currently controls audit export, redaction strictness, and retention settings exposed through deployment audit/admin policy evaluation seams.",
        governanceSensitivity: DeploymentPolicyGovernanceSensitivityLevels.governanceSensitive,
        governanceWarning:
          "Audit-governance settings influence audit visibility and retention posture; ensure policy changes preserve required compliance evidence windows.",
        governedFeatureAreas: [
          {
            areaId: "audit-admin-policy-decisions",
            label: "Audit/admin policy decisions",
            currentBehavior:
              "Audit-and-admin policy evaluation returns audit export, strict redaction, and retention settings from this family.",
          },
          {
            areaId: "policy-admin-inspection",
            label: "Policy administration visibility",
            currentBehavior:
              "Deployment policy admin inspection surfaces use this family's metadata to explain effective audit-governance behavior.",
          },
        ],
      },
      settings: [
        {
          settingKey: "auditExportEnabled",
          description: "Whether governed audit-export endpoints are enabled.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "auditRedactionStrictMode",
          description: "Whether strict redaction posture is enforced in audit read-models.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
          valueKind: DeploymentPolicyValueKinds.boolean,
        },
        {
          settingKey: "auditRetentionDays",
          description: "Default retention period for governed audit records.",
          controlMode: DeploymentPolicyControlModes.runtimeAdmin,
          defaultValue: 365,
          valueKind: DeploymentPolicyValueKinds.number,
          validationRules: [{
            type: "number-range",
            min: 30,
            max: 3650,
            integerOnly: true,
          }],
        },
      ],
    },
  ]);
}

export function createCanonicalDeploymentProfilePresetCatalog(
  familyCatalog: DeploymentPolicyFamilyCatalog = createCanonicalDeploymentPolicyFamilyCatalog(),
): DeploymentProfilePresetCatalog {
  const presetDefinitions = createCanonicalDeploymentProfilePresetDefinitions();

  return createDeploymentProfilePresetCatalog({
    familyCatalog,
    presets: Object.values(presetDefinitions).map((preset) => ({
      profileId: preset.profileId,
      parentProfileId: preset.parentProfileId,
      policyOverrides: preset.policyOverrides,
    })),
  });
}

export function createCanonicalDeploymentProfilePresetDefinitions(): DeploymentProfilePresetDefinitionCatalog {
  return Object.freeze({
    [DeploymentProfileIds.home]: Object.freeze({
      profileId: DeploymentProfileIds.home,
      scope: "Personal and family-managed deployments with lightweight governance overhead.",
      rationale:
        "Optimize for low-friction usage while preserving baseline safety controls and clear policy defaults.",
      policyOverrides: Object.freeze({
        "approval-governance": Object.freeze({
          runSubmissionApprovalMode: "self-or-owner",
          highRiskRunRequiresDualApproval: false,
        }),
        "sharing-posture": Object.freeze({
          defaultWorkspaceVisibility: "private",
          publicLinkSharingAllowed: true,
          crossWorkspaceShareRequiresApproval: false,
        }),
        "storage-governance": Object.freeze({
          defaultStorageTier: "local-managed",
          externalSyncEnabledByDefault: true,
        }),
        "security-governance": Object.freeze({
          encryptionAtRestRequired: true,
          transportTlsRequired: true,
          localCredentialRotationDays: 180,
        }),
        "admin-controls": Object.freeze({
          allowDelegatedWorkspaceAdmins: false,
          policyChangeRequiresTicketReference: false,
          policyDryRunModeEnabledByDefault: false,
        }),
        "audit-governance": Object.freeze({
          auditExportEnabled: false,
          auditRedactionStrictMode: false,
        }),
      }),
    }),
    [DeploymentProfileIds.classroom]: Object.freeze({
      profileId: DeploymentProfileIds.classroom,
      parentProfileId: DeploymentProfileIds.home,
      scope: "Instructor-governed collaborative deployments with bounded classroom sharing and review controls.",
      rationale:
        "Tighten collaboration and approval posture versus home environments while retaining instructor-operable defaults.",
      policyOverrides: Object.freeze({
        "approval-governance": Object.freeze({
          runSubmissionApprovalMode: "owner-or-instructor",
          highRiskRunRequiresDualApproval: true,
        }),
        "sharing-posture": Object.freeze({
          defaultWorkspaceVisibility: "workspace",
          publicLinkSharingAllowed: false,
          crossWorkspaceShareRequiresApproval: true,
        }),
        "storage-governance": Object.freeze({
          defaultStorageTier: "workspace-managed",
          externalSyncEnabledByDefault: false,
        }),
        "security-governance": Object.freeze({
          encryptionAtRestRequired: true,
          transportTlsRequired: true,
          localCredentialRotationDays: 120,
        }),
        "admin-controls": Object.freeze({
          allowDelegatedWorkspaceAdmins: true,
          policyChangeRequiresTicketReference: true,
          policyDryRunModeEnabledByDefault: true,
        }),
        "audit-governance": Object.freeze({
          auditExportEnabled: true,
          auditRedactionStrictMode: true,
        }),
      }),
    }),
    [DeploymentProfileIds.organization]: Object.freeze({
      profileId: DeploymentProfileIds.organization,
      parentProfileId: DeploymentProfileIds.classroom,
      scope: "Organization-wide governed deployments with stricter approval, storage, and credential posture.",
      rationale:
        "Apply enterprise-grade governance defaults while preserving centralized administration and auditable control.",
      policyOverrides: Object.freeze({
        "approval-governance": Object.freeze({
          runSubmissionApprovalMode: "owner-or-admin",
          highRiskRunRequiresDualApproval: true,
        }),
        "sharing-posture": Object.freeze({
          defaultWorkspaceVisibility: "workspace",
          publicLinkSharingAllowed: false,
          crossWorkspaceShareRequiresApproval: true,
        }),
        "storage-governance": Object.freeze({
          defaultStorageTier: "server-managed",
          externalSyncEnabledByDefault: false,
        }),
        "security-governance": Object.freeze({
          encryptionAtRestRequired: true,
          transportTlsRequired: true,
          localCredentialRotationDays: 90,
        }),
        "admin-controls": Object.freeze({
          allowDelegatedWorkspaceAdmins: true,
          policyChangeRequiresTicketReference: true,
          policyDryRunModeEnabledByDefault: true,
        }),
        "audit-governance": Object.freeze({
          auditExportEnabled: true,
          auditRedactionStrictMode: true,
        }),
      }),
    }),
  });
}

export function createCanonicalDeploymentPolicyConfigurationRegistry(): DeploymentPolicyConfigurationRegistry {
  const familyCatalog = createCanonicalDeploymentPolicyFamilyCatalog();
  const presetCatalog = createCanonicalDeploymentProfilePresetCatalog(familyCatalog);
  return createDeploymentPolicyConfigurationRegistry({
    familyCatalog,
    presetCatalog,
  });
}
