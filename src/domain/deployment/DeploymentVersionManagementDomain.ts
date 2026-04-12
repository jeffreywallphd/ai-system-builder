import type { DeploymentRecord } from "./DeploymentExecutionDomain";

export interface ManagedDeploymentVersion {
  readonly deploymentId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly bundleId: string;
  readonly bundleVersionKey: string;
  readonly packageId: string;
  readonly deploymentConfigurationId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly deploymentState: DeploymentRecord["state"];
  readonly deploymentStatus: DeploymentRecord["status"];
  readonly activationState: DeploymentRecord["activationState"];
  readonly activationUpdatedAt: string;
  readonly nestedSystemCount: number;
  readonly deployedAt: string;
}

export interface DeploymentHistoryQuery {
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId?: string;
  readonly targetId?: string;
  readonly targetType?: DeploymentRecord["targetType"];
}

export function toManagedDeploymentVersion(record: DeploymentRecord): ManagedDeploymentVersion {
  return Object.freeze({
    deploymentId: record.deploymentId,
    rootSystemAssetId: record.rootSystemAssetId,
    rootSystemVersionId: record.rootSystemVersionId,
    bundleId: record.bundleId,
    bundleVersionKey: record.bundleVersionKey,
    packageId: record.packageId,
    deploymentConfigurationId: record.deploymentConfigurationId,
    targetId: record.targetId,
    targetType: record.targetType,
    deploymentState: record.state,
    deploymentStatus: record.status,
    activationState: record.activationState,
    activationUpdatedAt: record.activationUpdatedAt,
    nestedSystemCount: record.nestedSystemCount,
    deployedAt: record.deployedAt,
  });
}
