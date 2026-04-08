import type {
  DeploymentPolicyFamilyId,
  DeploymentPolicyScalarValue,
  DeploymentPolicySettingKey,
  DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type {
  DeploymentPolicyAdminOverrideProvenance,
  DeploymentPolicyAdministrationContractVersion,
  DeploymentPolicyResolutionSource,
  DeploymentPolicyValidationOutcome,
  DeploymentPolicyValueKind,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export const DeploymentPolicyPersistenceScopeKinds = Object.freeze({
  deploymentPolicyScope: "deployment-policy-scope",
} as const);

export type DeploymentPolicyPersistenceScopeKind =
  typeof DeploymentPolicyPersistenceScopeKinds[keyof typeof DeploymentPolicyPersistenceScopeKinds];

export interface DeploymentPolicyPersistenceScope {
  readonly kind: DeploymentPolicyPersistenceScopeKind;
  readonly scopeId: string;
}

export interface DeploymentPolicyPersistenceWriteContext {
  readonly actorUserIdentityId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly ticketReference?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DeploymentPolicyPersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: DeploymentPolicyPersistenceWriteContext;
}

export interface DeploymentPolicyActiveProfileSelectionRecord {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId: DeploymentProfileId;
  readonly changedAt: string;
  readonly changedByUserIdentityId: string;
  readonly reason?: string;
  readonly ticketReference?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly revision: number;
}

export interface DeploymentPolicyOverridePersistenceRecord {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId: DeploymentProfileId;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly value: DeploymentPolicyScalarValue;
  readonly valueType: DeploymentPolicyValueKind;
  readonly provenance?: DeploymentPolicyAdminOverrideProvenance;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly revision: number;
}

export const DeploymentPolicyOverrideHistoryOperationKinds = Object.freeze({
  upsert: "upsert",
  remove: "remove",
} as const);

export type DeploymentPolicyOverrideHistoryOperationKind =
  typeof DeploymentPolicyOverrideHistoryOperationKinds[keyof typeof DeploymentPolicyOverrideHistoryOperationKinds];

export interface DeploymentPolicyOverrideHistoryRecord {
  readonly changeId: string;
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId: DeploymentProfileId;
  readonly familyId: DeploymentPolicyFamilyId;
  readonly settingKey: DeploymentPolicySettingKey;
  readonly operation: DeploymentPolicyOverrideHistoryOperationKind;
  readonly value?: DeploymentPolicyScalarValue;
  readonly valueType?: DeploymentPolicyValueKind;
  readonly provenance?: DeploymentPolicyAdminOverrideProvenance;
  readonly operationKey: string;
  readonly changedAt: string;
  readonly changedByUserIdentityId: string;
  readonly reason?: string;
  readonly ticketReference?: string;
  readonly correlationId?: string;
  readonly revision: number;
}

export interface DeploymentPolicyEffectiveMetadataRecord {
  readonly scope: DeploymentPolicyPersistenceScope;
  readonly profileId: DeploymentProfileId;
  readonly evaluatedAt: string;
  readonly evaluationLayer: "domain" | "application";
  readonly contractVersion: DeploymentPolicyAdministrationContractVersion;
  readonly familyCount: number;
  readonly settingCount: number;
  readonly sourceCounts: Readonly<Record<DeploymentPolicyResolutionSource, number>>;
  readonly validation: DeploymentPolicyValidationOutcome;
  readonly recordedAt: string;
  readonly recordedByUserIdentityId: string;
  readonly revision: number;
}

export interface DeploymentPolicyPersistenceMutationResult<TRecord> {
  readonly record: TRecord;
  readonly changed: boolean;
  readonly wasReplay: boolean;
}

function normalizeScopeId(scopeId: string): string {
  const normalized = scopeId.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Deployment policy persistence scopeId is required.");
  }
  return normalized;
}

export function createDeploymentPolicyPersistenceScope(input: {
  readonly kind?: DeploymentPolicyPersistenceScopeKind;
  readonly scopeId: string;
}): DeploymentPolicyPersistenceScope {
  return Object.freeze({
    kind: input.kind ?? DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
    scopeId: normalizeScopeId(input.scopeId),
  });
}

export function normalizeDeploymentPolicyMutationOperationKey(operationKey: string): string {
  try {
    return normalizePersistenceOperationKey(operationKey);
  } catch {
    throw new Error("Deployment policy persistence mutation operationKey is required.");
  }
}

