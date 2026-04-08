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

export type DeploymentPolicyScalarValue = string | number | boolean;
export type DeploymentPolicyFamilyId = string;
export type DeploymentPolicySettingKey = string;

export interface DeploymentPolicySettingDefinition {
  readonly settingKey: DeploymentPolicySettingKey;
  readonly description: string;
  readonly controlMode: DeploymentPolicyControlMode;
  readonly defaultValue: DeploymentPolicyScalarValue;
}

export interface DeploymentPolicyFamilyDefinition {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly description: string;
  readonly settings: ReadonlyArray<DeploymentPolicySettingDefinition>;
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

const CanonicalProfileIds = new Set<DeploymentProfileId>(Object.values(DeploymentProfileIds));
const PolicyFamilyIdPattern = /^[a-z][a-z0-9-]{2,126}$/;
const PolicySettingKeyPattern = /^[a-z][a-zA-Z0-9]{2,126}$/;

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

function scalarType(value: DeploymentPolicyScalarValue): string {
  return typeof value;
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

export function normalizeDeploymentProfileId(value: string): DeploymentProfileId {
  const normalized = normalizeRequired(value, "Deployment profile id").toLowerCase();
  if (normalized.startsWith("deployment-profile:")) {
    return normalizeDeploymentProfileId(normalized.slice("deployment-profile:".length));
  }
  return assertProfileId(normalized);
}

function normalizeSettingDefinition(input: DeploymentPolicySettingDefinition): DeploymentPolicySettingDefinition {
  const settingKey = normalizeRequired(input.settingKey, "Deployment policy setting key");
  if (!PolicySettingKeyPattern.test(settingKey)) {
    throw new DeploymentProfilePolicyAdministrationDomainError(
      `Deployment policy setting key '${settingKey}' must start with a letter and use alphanumeric camel-case characters.`,
    );
  }

  return Object.freeze({
    settingKey,
    description: normalizeRequired(input.description, `Deployment policy setting '${settingKey}' description`),
    controlMode: assertControlMode(input.controlMode),
    defaultValue: input.defaultValue,
  });
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
    description: normalizeRequired(input.description, `Deployment policy family '${familyId}' description`),
    settings: Object.freeze([...bySetting.values()]),
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
    if (scalarType(settingDefinition.defaultValue) !== scalarType(rawValue)) {
      throw new DeploymentProfilePolicyAdministrationDomainError(
        `Policy setting '${input.familyId}.${settingKey}' expects '${scalarType(settingDefinition.defaultValue)}' values.`,
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
    readonly policyOverrides?: Readonly<Record<string, Readonly<Record<string, DeploymentPolicyScalarValue>>>;
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

export function isDeploymentPolicyAdminOverrideAllowed(controlMode: DeploymentPolicyControlMode): boolean {
  return controlMode === DeploymentPolicyControlModes.profileDefaultAdminOverridable
    || controlMode === DeploymentPolicyControlModes.runtimeAdmin;
}

export function createCanonicalDeploymentPolicyFamilyCatalog(): DeploymentPolicyFamilyCatalog {
  return createDeploymentPolicyFamilyCatalog([
    {
      familyId: "approval-governance",
      description: "Run and workflow approval strictness, escalation posture, and privileged action governance.",
      settings: [
        {
          settingKey: "runSubmissionApprovalMode",
          description: "Default run-submission approval strategy for the deployment profile.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: "owner-or-admin",
        },
        {
          settingKey: "highRiskRunRequiresDualApproval",
          description: "Whether high-risk run classes require dual-approval workflow.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
        {
          settingKey: "approvalEscalationTimeoutMinutes",
          description: "Escalation timeout for unresolved approval requests.",
          controlMode: DeploymentPolicyControlModes.runtimeAdmin,
          defaultValue: 120,
        },
      ],
    },
    {
      familyId: "sharing-posture",
      description: "Default resource visibility and sharing constraints for collaborative surfaces.",
      settings: [
        {
          settingKey: "defaultWorkspaceVisibility",
          description: "Default visibility for newly published workspace resources.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: "workspace",
        },
        {
          settingKey: "publicLinkSharingAllowed",
          description: "Whether public-link sharing is allowed in the deployment profile.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: false,
        },
        {
          settingKey: "crossWorkspaceShareRequiresApproval",
          description: "Whether cross-workspace sharing requires explicit approval.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
      ],
    },
    {
      familyId: "storage-governance",
      description: "Storage defaults, synchronization posture, and retention controls.",
      settings: [
        {
          settingKey: "defaultStorageTier",
          description: "Default storage tier for new workspace storage allocations.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: "server-managed",
        },
        {
          settingKey: "externalSyncEnabledByDefault",
          description: "Whether external synchronization is enabled by profile default.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: false,
        },
        {
          settingKey: "retentionDaysDefault",
          description: "Default retention period for governed storage surfaces.",
          controlMode: DeploymentPolicyControlModes.runtimeAdmin,
          defaultValue: 90,
        },
      ],
    },
    {
      familyId: "security-governance",
      description: "Security baseline controls for transport, encryption, and credential rotation posture.",
      settings: [
        {
          settingKey: "encryptionAtRestRequired",
          description: "Whether encryption at rest is mandatory.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
        {
          settingKey: "transportTlsRequired",
          description: "Whether TLS is mandatory for non-loopback runtime transport.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
        {
          settingKey: "localCredentialRotationDays",
          description: "Credential rotation window used by policy reminders and checks.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: 90,
        },
      ],
    },
    {
      familyId: "admin-controls",
      description: "Administrative delegation and policy-mutation governance controls.",
      settings: [
        {
          settingKey: "allowDelegatedWorkspaceAdmins",
          description: "Whether delegated workspace administrators are allowed.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
        {
          settingKey: "policyChangeRequiresTicketReference",
          description: "Whether policy changes require external ticket/change-reference attribution.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
        {
          settingKey: "policyDryRunModeEnabledByDefault",
          description: "Whether dry-run mode is enabled by default in policy administration workflows.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: true,
        },
      ],
    },
    {
      familyId: "audit-governance",
      description: "Audit event posture, redaction strictness, and retention administration settings.",
      settings: [
        {
          settingKey: "auditExportEnabled",
          description: "Whether governed audit-export endpoints are enabled.",
          controlMode: DeploymentPolicyControlModes.profileDefaultAdminOverridable,
          defaultValue: true,
        },
        {
          settingKey: "auditRedactionStrictMode",
          description: "Whether strict redaction posture is enforced in audit read-models.",
          controlMode: DeploymentPolicyControlModes.profileFixed,
          defaultValue: true,
        },
        {
          settingKey: "auditRetentionDays",
          description: "Default retention period for governed audit records.",
          controlMode: DeploymentPolicyControlModes.runtimeAdmin,
          defaultValue: 365,
        },
      ],
    },
  ]);
}

export function createCanonicalDeploymentProfilePresetCatalog(
  familyCatalog: DeploymentPolicyFamilyCatalog = createCanonicalDeploymentPolicyFamilyCatalog(),
): DeploymentProfilePresetCatalog {
  return createDeploymentProfilePresetCatalog({
    familyCatalog,
    presets: [
      {
        profileId: DeploymentProfileIds.home,
        policyOverrides: {
          "approval-governance": {
            runSubmissionApprovalMode: "self-or-owner",
            highRiskRunRequiresDualApproval: false,
          },
          "sharing-posture": {
            defaultWorkspaceVisibility: "private",
            publicLinkSharingAllowed: true,
            crossWorkspaceShareRequiresApproval: false,
          },
          "storage-governance": {
            defaultStorageTier: "local-managed",
            externalSyncEnabledByDefault: true,
          },
          "security-governance": {
            localCredentialRotationDays: 180,
          },
          "admin-controls": {
            allowDelegatedWorkspaceAdmins: false,
            policyChangeRequiresTicketReference: false,
            policyDryRunModeEnabledByDefault: false,
          },
          "audit-governance": {
            auditExportEnabled: false,
            auditRedactionStrictMode: false,
          },
        },
      },
      {
        profileId: DeploymentProfileIds.classroom,
        parentProfileId: DeploymentProfileIds.home,
        policyOverrides: {
          "approval-governance": {
            runSubmissionApprovalMode: "owner-or-instructor",
            highRiskRunRequiresDualApproval: true,
          },
          "sharing-posture": {
            defaultWorkspaceVisibility: "workspace",
            publicLinkSharingAllowed: false,
            crossWorkspaceShareRequiresApproval: true,
          },
          "storage-governance": {
            defaultStorageTier: "workspace-managed",
            externalSyncEnabledByDefault: false,
          },
          "security-governance": {
            localCredentialRotationDays: 120,
          },
          "admin-controls": {
            allowDelegatedWorkspaceAdmins: true,
            policyChangeRequiresTicketReference: true,
            policyDryRunModeEnabledByDefault: true,
          },
          "audit-governance": {
            auditExportEnabled: true,
            auditRedactionStrictMode: true,
          },
        },
      },
      {
        profileId: DeploymentProfileIds.organization,
        parentProfileId: DeploymentProfileIds.classroom,
        policyOverrides: {
          "approval-governance": {
            runSubmissionApprovalMode: "owner-or-admin",
          },
          "storage-governance": {
            defaultStorageTier: "server-managed",
            externalSyncEnabledByDefault: false,
          },
          "security-governance": {
            localCredentialRotationDays: 90,
          },
          "admin-controls": {
            allowDelegatedWorkspaceAdmins: true,
            policyChangeRequiresTicketReference: true,
            policyDryRunModeEnabledByDefault: true,
          },
          "audit-governance": {
            auditExportEnabled: true,
            auditRedactionStrictMode: true,
          },
        },
      },
    ],
  });
}
