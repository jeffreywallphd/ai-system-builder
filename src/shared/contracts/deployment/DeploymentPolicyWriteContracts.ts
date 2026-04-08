import type {
  DeploymentPolicyAdministrationSnapshot,
  DeploymentPolicyAdminOverrideProvenance,
  DeploymentPolicyControlMode,
  DeploymentPolicyUpdateOperation,
  DeploymentPolicyValidationOutcome,
  DeploymentPolicyValueKind,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type {
  DeploymentPolicyActiveProfileSelectionRecord,
  DeploymentPolicyEffectiveMetadataRecord,
  DeploymentPolicyPersistenceMutationResult,
  DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import type {
  DeploymentPolicyFamilyId,
  DeploymentPolicyScalarValue,
  DeploymentPolicySettingKey,
  DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";

export const DeploymentPolicyWriteTransportRoutes = Object.freeze({
  updateActiveProfile: "/api/v1/deployment/policy/active-profile",
  applyOverrides: "/api/v1/deployment/policy/overrides",
} as const);

export interface UpdateDeploymentPolicyActiveProfileRequest {
  readonly profileId: DeploymentProfileId;
  readonly dryRun?: boolean;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly ticketReference?: string;
  readonly correlationId?: string;
  readonly expectedRevision?: number;
}

export interface DeploymentPolicyOverrideOperationRequest {
  readonly operation: DeploymentPolicyUpdateOperation["operation"];
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly value?: DeploymentPolicyScalarValue;
  readonly valueType?: DeploymentPolicyValueKind;
  readonly expectedControlMode?: DeploymentPolicyControlMode;
  readonly provenance?: Omit<DeploymentPolicyAdminOverrideProvenance, "actorUserIdentityId">;
}

export interface ApplyDeploymentPolicyOverrideOperationsRequest {
  readonly profileId: DeploymentProfileId;
  readonly operations: ReadonlyArray<DeploymentPolicyOverrideOperationRequest>;
  readonly dryRun?: boolean;
  readonly occurredAt?: string;
  readonly submittedAt?: string;
  readonly reason?: string;
  readonly ticketReference?: string;
  readonly correlationId?: string;
  readonly expectedRevision?: number;
}

export interface DeploymentPolicyWriteMutationOutcome {
  readonly operation: DeploymentPolicyUpdateOperation;
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly recordRevision: number;
}

export interface DeploymentPolicyWriteResult {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly dryRun: boolean;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly activeProfileSelection?: DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>;
  readonly overrideMutations: ReadonlyArray<DeploymentPolicyWriteMutationOutcome>;
  readonly effectiveMetadata?: DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>;
  readonly snapshot: DeploymentPolicyAdministrationSnapshot;
}

export interface UpdateDeploymentPolicyActiveProfileResponse {
  readonly result: DeploymentPolicyWriteResult;
}

export interface ApplyDeploymentPolicyOverrideOperationsResponse {
  readonly result: DeploymentPolicyWriteResult;
}
