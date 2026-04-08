import type {
  DeploymentPolicyActiveProfileSelectionRecord,
  DeploymentPolicyEffectiveMetadataRecord,
  DeploymentPolicyOverrideHistoryRecord,
  DeploymentPolicyOverridePersistenceRecord,
  DeploymentPolicyPersistenceMutationEnvelope,
  DeploymentPolicyPersistenceMutationResult,
  DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import type {
  DeploymentPolicyFamilyId,
  DeploymentPolicySettingKey,
  DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";

export interface DeploymentPolicyOverrideLookupQuery {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId?: DeploymentProfileId;
  readonly familyId?: DeploymentPolicyFamilyId;
  readonly settingKey?: DeploymentPolicySettingKey;
}

export interface DeploymentPolicyOverrideHistoryQuery extends DeploymentPolicyOverrideLookupQuery {
  readonly limit?: number;
  readonly offset?: number;
}

export interface UpsertDeploymentPolicyOverridePersistenceRecordInput {
  readonly record: DeploymentPolicyOverridePersistenceRecord;
  readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
}

export interface RemoveDeploymentPolicyOverridePersistenceRecordInput {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId: DeploymentProfileId;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
}

export interface SaveDeploymentPolicyEffectiveMetadataInput {
  readonly record: DeploymentPolicyEffectiveMetadataRecord;
  readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
}

export interface IDeploymentPolicyPersistenceRepository {
  getActiveProfileSelection(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyActiveProfileSelectionRecord | undefined>;
  setActiveProfileSelection(input: {
    readonly record: DeploymentPolicyActiveProfileSelectionRecord;
    readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
  }): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>>;

  listOverrideRecords(
    query: DeploymentPolicyOverrideLookupQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>>;
  upsertOverrideRecord(
    input: UpsertDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverridePersistenceRecord>>;
  removeOverrideRecord(
    input: RemoveDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverrideHistoryRecord>>;

  listOverrideHistory(
    query: DeploymentPolicyOverrideHistoryQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverrideHistoryRecord>>;

  getEffectivePolicyMetadata(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyEffectiveMetadataRecord | undefined>;
  saveEffectivePolicyMetadata(
    input: SaveDeploymentPolicyEffectiveMetadataInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>>;
}

