import {
  DeploymentPolicyControlModes,
  DeploymentPolicyFamilyIds,
  type DeploymentPolicyFamilyId,
  type DeploymentPolicyScalarValue,
  type DeploymentPolicySettingKey,
  type DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  DeploymentPolicyResolutionSources,
  type DeploymentPolicyResolvedSetting,
  type DeploymentPolicyResolutionSource,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  DeploymentPolicyFamilyMetadataReadModel,
  ReadDeploymentPolicyStateResponse,
} from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import type { DeploymentPolicyOverridePersistenceRecord } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";

export interface DeploymentPolicyProfilePresetComparison {
  readonly profileId: DeploymentProfileId;
  readonly scopeLabel: string;
  readonly rationale: string;
  readonly isActiveProfile: boolean;
  readonly isRequestedProfile: boolean;
  readonly lineage: ReadonlyArray<DeploymentProfileId>;
}

export interface DeploymentPolicyEffectiveSettingReadModel {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly familyLabel: string;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly description: string;
  readonly controlMode: DeploymentPolicyResolvedSetting["controlMode"];
  readonly valueType: DeploymentPolicyResolvedSetting["valueType"];
  readonly effectiveValue: DeploymentPolicyScalarValue;
  readonly effectiveValueDisplay: string;
  readonly effectiveSource: DeploymentPolicyResolutionSource;
  readonly sourceLabel: string;
  readonly provenanceSummary: string;
  readonly administrationStatus: "editable" | "inspect-only" | "unsupported";
  readonly administrationStatusReason: string;
  readonly overrideRecord?: DeploymentPolicyOverridePersistenceRecord;
  readonly validationRuleSummary?: string;
}

export interface DeploymentPolicyGroupReadModel {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly title: string;
  readonly description: string;
  readonly scopeLabel: string;
  readonly settings: ReadonlyArray<DeploymentPolicyEffectiveSettingReadModel>;
}

export interface DeploymentPolicyAdministrationInspectionReadModel {
  readonly workspaceId: string;
  readonly activeProfileId: DeploymentProfileId;
  readonly requestedProfileId: DeploymentProfileId;
  readonly activeProfileSourceLabel: string;
  readonly activeProfileSummary: string;
  readonly evaluatedAt: string;
  readonly totalFamilyCount: number;
  readonly totalSettingCount: number;
  readonly sourceBreakdown: Readonly<Record<string, number>>;
  readonly presetComparisons: ReadonlyArray<DeploymentPolicyProfilePresetComparison>;
  readonly policyGroups: ReadonlyArray<DeploymentPolicyGroupReadModel>;
  readonly validationIssueCount: number;
}

const FamilyTitleById: Readonly<Record<string, string>> = Object.freeze({
  [DeploymentPolicyFamilyIds.approvalGovernance]: "Approval governance",
  [DeploymentPolicyFamilyIds.sharingPosture]: "Sharing posture",
  [DeploymentPolicyFamilyIds.storageGovernance]: "Storage governance",
  [DeploymentPolicyFamilyIds.securityGovernance]: "Security governance",
  [DeploymentPolicyFamilyIds.adminControls]: "Administrative controls",
  [DeploymentPolicyFamilyIds.auditGovernance]: "Audit governance",
});

const FamilyOrderById: Readonly<Record<string, number>> = Object.freeze({
  [DeploymentPolicyFamilyIds.approvalGovernance]: 10,
  [DeploymentPolicyFamilyIds.sharingPosture]: 20,
  [DeploymentPolicyFamilyIds.storageGovernance]: 30,
  [DeploymentPolicyFamilyIds.securityGovernance]: 40,
  [DeploymentPolicyFamilyIds.adminControls]: 50,
  [DeploymentPolicyFamilyIds.auditGovernance]: 60,
});

export function buildDeploymentPolicyAdministrationInspectionReadModel(
  response: ReadDeploymentPolicyStateResponse,
): DeploymentPolicyAdministrationInspectionReadModel {
  const requestedProfileId = response.snapshot.profileId;
  const overridesBySetting = mapOverrideRecords(response.overrideRecords);
  const catalogFamilies = response.catalog?.families ?? Object.freeze({});

  const policyGroups = Object.entries(response.snapshot.families)
    .map(([familyId, familySnapshot]) => {
      const metadata = catalogFamilies[familyId as DeploymentPolicyFamilyId];
      const title = FamilyTitleById[familyId] ?? toTitleCase(familyId);
      const scopeLabel = metadata?.scope ?? "deployment-profile";

      const settings = Object.entries(familySnapshot.settings)
        .map(([settingKey, setting]) => toEffectiveSettingReadModel({
          familyId: familyId as DeploymentPolicyFamilyId,
          settingKey: settingKey as DeploymentPolicySettingKey,
          setting,
          familyLabel: title,
          metadata,
          requestedProfileId,
          overrideRecord: overridesBySetting.get(buildSettingPath(familyId, settingKey)),
        }))
        .sort((left, right) => left.settingKey.localeCompare(right.settingKey));

      return Object.freeze({
        familyId: familyId as DeploymentPolicyFamilyId,
        title,
        description: metadata?.description ?? `Policy family '${familyId}'.`,
        scopeLabel,
        settings: Object.freeze(settings),
      });
    })
    .sort((left, right) => {
      const leftOrder = FamilyOrderById[left.familyId] ?? 1000;
      const rightOrder = FamilyOrderById[right.familyId] ?? 1000;
      return leftOrder - rightOrder || left.familyId.localeCompare(right.familyId);
    });

  const presetComparisons = buildPresetComparisons(response);
  const sourceBreakdown = Object.freeze({ ...response.snapshot.summary.sourceCounts });

  return Object.freeze({
    workspaceId: response.scope.scopeId,
    activeProfileId: response.activeProfile.profileId,
    requestedProfileId,
    activeProfileSourceLabel: response.activeProfile.source === "persisted-selection"
      ? "Persisted profile selection"
      : "Default fallback profile",
    activeProfileSummary: response.activeProfile.source === "persisted-selection"
      ? `Active profile is persisted as '${response.activeProfile.profileId}'.`
      : "No persisted active-profile selection was found; defaulted to 'home'.",
    evaluatedAt: response.snapshot.evaluatedAt,
    totalFamilyCount: response.snapshot.summary.familyCount,
    totalSettingCount: response.snapshot.summary.settingCount,
    sourceBreakdown,
    presetComparisons,
    policyGroups: Object.freeze(policyGroups),
    validationIssueCount: response.validation.issues.length,
  });
}

function toEffectiveSettingReadModel(input: {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly setting: DeploymentPolicyResolvedSetting;
  readonly familyLabel: string;
  readonly metadata?: DeploymentPolicyFamilyMetadataReadModel;
  readonly requestedProfileId: DeploymentProfileId;
  readonly overrideRecord?: DeploymentPolicyOverridePersistenceRecord;
}): DeploymentPolicyEffectiveSettingReadModel {
  const settingMetadata = input.metadata?.settings?.[input.settingKey];
  const sourceLabel = toSourceLabel(input.setting.source);
  const administrationStatus = resolveAdministrationStatus(input.setting.controlMode, input.setting.valueType);
  const provenanceSummary = describeSettingProvenance({
    source: input.setting.source,
    requestedProfileId: input.requestedProfileId,
    overrideRecord: input.overrideRecord,
    setting: input.setting,
  });

  return Object.freeze({
    familyId: input.familyId,
    familyLabel: input.familyLabel,
    settingKey: input.settingKey,
    description: settingMetadata?.description ?? `${input.familyId}.${input.settingKey}`,
    controlMode: input.setting.controlMode,
    valueType: input.setting.valueType,
    effectiveValue: input.setting.value,
    effectiveValueDisplay: formatScalarValue(input.setting.value),
    effectiveSource: input.setting.source,
    sourceLabel,
    provenanceSummary,
    administrationStatus: administrationStatus.status,
    administrationStatusReason: administrationStatus.reason,
    overrideRecord: input.overrideRecord,
    validationRuleSummary: summarizeValidationRules(settingMetadata?.validationRules),
  });
}

function describeSettingProvenance(input: {
  readonly source: DeploymentPolicyResolutionSource;
  readonly requestedProfileId: DeploymentProfileId;
  readonly overrideRecord?: DeploymentPolicyOverridePersistenceRecord;
  readonly setting: DeploymentPolicyResolvedSetting;
}): string {
  if (input.source === DeploymentPolicyResolutionSources.adminState) {
    const provenance = input.overrideRecord?.provenance ?? input.setting.adminOverrideProvenance;
    const actor = provenance?.actorUserIdentityId ?? input.overrideRecord?.lastModifiedBy ?? "an administrator";
    const updatedAt = provenance?.updatedAt ?? input.overrideRecord?.lastModifiedAt;
    const ticket = provenance?.ticketReference ? ` Ticket: ${provenance.ticketReference}.` : "";
    const reason = provenance?.reason ? ` Reason: ${provenance.reason}.` : "";
    const when = updatedAt ? ` Updated at ${updatedAt}.` : "";
    return `Effective value comes from an admin override by ${actor}.${when}${ticket}${reason}`.trim();
  }

  if (input.source === DeploymentPolicyResolutionSources.profilePreset) {
    return `Effective value comes from the '${input.requestedProfileId}' preset lineage.`;
  }

  return "Effective value uses the policy catalog default because no preset or override value applies.";
}

function toSourceLabel(source: DeploymentPolicyResolutionSource): string {
  if (source === DeploymentPolicyResolutionSources.adminState) {
    return "Admin override";
  }
  if (source === DeploymentPolicyResolutionSources.profilePreset) {
    return "Preset default";
  }
  return "Policy default";
}

function buildPresetComparisons(
  response: ReadDeploymentPolicyStateResponse,
): ReadonlyArray<DeploymentPolicyProfilePresetComparison> {
  const presetEntries = Object.values(response.catalog?.presets ?? Object.freeze({}));
  const requestedProfileId = response.snapshot.profileId;

  if (presetEntries.length < 1) {
    return Object.freeze([
      Object.freeze({
        profileId: requestedProfileId,
        scopeLabel: "not provided",
        rationale: "Preset catalog metadata was not included in this response.",
        isActiveProfile: requestedProfileId === response.activeProfile.profileId,
        isRequestedProfile: true,
        lineage: response.snapshot.preset.lineage,
      }),
    ]);
  }

  return Object.freeze(
    presetEntries
      .map((preset) => Object.freeze({
        profileId: preset.profileId,
        scopeLabel: preset.scope,
        rationale: preset.rationale,
        isActiveProfile: preset.profileId === response.activeProfile.profileId,
        isRequestedProfile: preset.profileId === requestedProfileId,
        lineage: preset.lineage,
      }))
      .sort((left, right) => left.lineage.length - right.lineage.length || left.profileId.localeCompare(right.profileId)),
  );
}

function mapOverrideRecords(
  overrideRecords: ReadonlyArray<DeploymentPolicyOverridePersistenceRecord> | undefined,
): ReadonlyMap<string, DeploymentPolicyOverridePersistenceRecord> {
  const map = new Map<string, DeploymentPolicyOverridePersistenceRecord>();
  for (const record of overrideRecords ?? []) {
    map.set(buildSettingPath(record.familyId, record.settingKey), record);
  }
  return map;
}

function buildSettingPath(familyId: string, settingKey: string): string {
  return `${familyId}.${settingKey}`;
}

function summarizeValidationRules(
  rules: ReadonlyArray<{ readonly type: "enum" | "number-range"; readonly allowedValues?: ReadonlyArray<string>; readonly min?: number; readonly max?: number; readonly integerOnly?: boolean; }> | undefined,
): string | undefined {
  if (!rules || rules.length < 1) {
    return undefined;
  }

  return rules.map((rule) => {
    if (rule.type === "enum") {
      return `Allowed: ${(rule.allowedValues ?? []).join(", ")}`;
    }
    return `Range: ${rule.min ?? "-inf"} to ${rule.max ?? "+inf"}${rule.integerOnly ? " (integer only)" : ""}`;
  }).join("; ");
}

function formatScalarValue(value: DeploymentPolicyScalarValue): string {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}

function toTitleCase(value: string): string {
  return value
    .split("-")
    .map((segment) => segment.length > 0
      ? `${segment[0]!.toUpperCase()}${segment.slice(1)}`
      : segment)
    .join(" ");
}

export function toControlModeLabel(controlMode: DeploymentPolicyResolvedSetting["controlMode"]): string {
  if (controlMode === DeploymentPolicyControlModes.profileFixed) {
    return "Profile fixed";
  }
  if (controlMode === DeploymentPolicyControlModes.profileDefaultAdminOverridable) {
    return "Profile default (admin overridable)";
  }
  return "Runtime admin";
}

export function toAdministrationStatusLabel(status: DeploymentPolicyEffectiveSettingReadModel["administrationStatus"]): string {
  if (status === "editable") {
    return "Editable";
  }
  if (status === "inspect-only") {
    return "Inspect only";
  }
  return "Unsupported";
}

function resolveAdministrationStatus(
  controlMode: DeploymentPolicyResolvedSetting["controlMode"],
  valueType: DeploymentPolicyResolvedSetting["valueType"],
): { readonly status: DeploymentPolicyEffectiveSettingReadModel["administrationStatus"]; readonly reason: string } {
  if (controlMode === DeploymentPolicyControlModes.profileFixed) {
    return Object.freeze({
      status: "inspect-only",
      reason: "Profile-fixed policy settings are inspect-only and cannot be changed by admin override operations.",
    });
  }

  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return Object.freeze({
      status: "editable",
      reason: "Supported setting type and control mode can be updated through authoritative policy-write workflows.",
    });
  }

  return Object.freeze({
    status: "unsupported",
    reason: "This policy setting type is not supported by current admin-write workflows.",
  });
}
