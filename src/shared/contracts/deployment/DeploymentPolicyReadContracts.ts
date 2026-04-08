import type {
  DeploymentPolicyFamilyDefinition,
  DeploymentPolicyFamilyId,
  DeploymentPolicyFamilyScope,
  DeploymentPolicySettingDefinition,
  DeploymentPolicySettingKey,
  DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type {
  DeploymentPolicyAdministrationSnapshot,
  DeploymentPolicyValidationOutcome,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  DeploymentPolicyActiveProfileSelectionRecord,
  DeploymentPolicyEffectiveMetadataRecord,
  DeploymentPolicyOverridePersistenceRecord,
  DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";

export const DeploymentPolicyReadTransportRoutes = Object.freeze({
  readState: "/api/v1/deployment/policy/state",
} as const);

export const DeploymentPolicyActiveProfileSourceKinds = Object.freeze({
  persistedSelection: "persisted-selection",
  defaultFallback: "default-fallback",
} as const);

export type DeploymentPolicyActiveProfileSourceKind =
  typeof DeploymentPolicyActiveProfileSourceKinds[keyof typeof DeploymentPolicyActiveProfileSourceKinds];

export interface DeploymentPolicyActiveProfileReadModel {
  readonly profileId: DeploymentProfileId;
  readonly source: DeploymentPolicyActiveProfileSourceKind;
  readonly selectionRecord?: DeploymentPolicyActiveProfileSelectionRecord;
}

export interface DeploymentPolicyPresetReadModel {
  readonly profileId: DeploymentProfileId;
  readonly parentProfileId?: DeploymentProfileId;
  readonly lineage: ReadonlyArray<DeploymentProfileId>;
  readonly inheritedFrom: ReadonlyArray<DeploymentProfileId>;
  readonly scope: string;
  readonly rationale: string;
}

export interface DeploymentPolicySettingMetadataReadModel {
  readonly settingKey: DeploymentPolicySettingKey;
  readonly description: string;
  readonly controlMode: DeploymentPolicySettingDefinition["controlMode"];
  readonly defaultValue: DeploymentPolicySettingDefinition["defaultValue"];
  readonly valueKind: DeploymentPolicySettingDefinition["valueKind"];
  readonly validationRules: DeploymentPolicySettingDefinition["validationRules"];
}

export interface DeploymentPolicyFamilyMetadataReadModel {
  readonly familyId: DeploymentPolicyFamilyId;
  readonly description: string;
  readonly scope: DeploymentPolicyFamilyScope;
  readonly settings: Readonly<Record<DeploymentPolicySettingKey, DeploymentPolicySettingMetadataReadModel>>;
}

export interface DeploymentPolicyCatalogReadModel {
  readonly presets: Readonly<Record<DeploymentProfileId, DeploymentPolicyPresetReadModel>>;
  readonly families: Readonly<Record<DeploymentPolicyFamilyId, DeploymentPolicyFamilyMetadataReadModel>>;
}

export interface ReadDeploymentPolicyStateRequest {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly actorUserIdentityId: string;
  readonly profileId?: DeploymentProfileId;
  readonly includeCatalog?: boolean;
  readonly includeOverrideRecords?: boolean;
  readonly includeEffectiveMetadata?: boolean;
  readonly evaluatedAt?: string;
}

export interface ReadDeploymentPolicyStateResponse {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly activeProfile: DeploymentPolicyActiveProfileReadModel;
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly overrideRecords?: ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>;
  readonly effectiveMetadata?: DeploymentPolicyEffectiveMetadataRecord;
  readonly catalog?: DeploymentPolicyCatalogReadModel;
}

export function toDeploymentPolicyFamilyMetadataReadModel(
  family: DeploymentPolicyFamilyDefinition,
): DeploymentPolicyFamilyMetadataReadModel {
  const settings: Record<DeploymentPolicySettingKey, DeploymentPolicySettingMetadataReadModel> = {};
  for (const setting of family.settings) {
    settings[setting.settingKey] = Object.freeze({
      settingKey: setting.settingKey,
      description: setting.description,
      controlMode: setting.controlMode,
      defaultValue: setting.defaultValue,
      valueKind: setting.valueKind,
      validationRules: setting.validationRules,
    });
  }

  return Object.freeze({
    familyId: family.familyId,
    description: family.description,
    scope: family.scope,
    settings: Object.freeze(settings),
  });
}
