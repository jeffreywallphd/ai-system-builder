import type { DeploymentBundle } from "./DeploymentBundleDomain";
import type { DeploymentConfigurationContract } from "./DeploymentConfigurationDomain";
import type { DeploymentTarget } from "./DeploymentTargetDomain";
import type { ProvisionedDeploymentEnvironment } from "./EnvironmentProvisioningDomain";

export const DeploymentStatuses = Object.freeze({
  pending: "pending",
  succeeded: "succeeded",
  rejected: "rejected",
});

export type DeploymentStatus = typeof DeploymentStatuses[keyof typeof DeploymentStatuses];

export interface DeploymentExecutionRequest {
  readonly requestId: string;
  readonly bundle: DeploymentBundle;
  readonly deploymentConfiguration: DeploymentConfigurationContract;
  readonly target: DeploymentTarget;
  readonly provisionedEnvironment: ProvisionedDeploymentEnvironment;
  readonly requestedAt: string;
}

export interface DeploymentRecord {
  readonly deploymentId: string;
  readonly requestId: string;
  readonly status: DeploymentStatus;
  readonly bundleId: string;
  readonly bundleVersionKey: string;
  readonly packageId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly deploymentConfigurationId: string;
  readonly targetId: string;
  readonly targetType: DeploymentTarget["type"];
  readonly provisionedEnvironmentId: string;
  readonly nestedSystemCount: number;
  readonly deployedAt: string;
  readonly metadata: {
    readonly deploymentDeterminismKey: string;
    readonly notes: ReadonlyArray<string>;
  };
}

export interface DeploymentExecutionResult {
  readonly status: DeploymentStatus;
  readonly deployment?: DeploymentRecord;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
}

export function createDeploymentExecutionRequest(input: DeploymentExecutionRequest): DeploymentExecutionRequest {
  const requestId = input.requestId.trim();
  if (!requestId) {
    throw new Error("Deployment execution request id is required.");
  }
  const requestedAt = input.requestedAt.trim();
  if (!requestedAt) {
    throw new Error("Deployment execution requestedAt is required.");
  }

  return Object.freeze({
    requestId,
    bundle: input.bundle,
    deploymentConfiguration: input.deploymentConfiguration,
    target: input.target,
    provisionedEnvironment: input.provisionedEnvironment,
    requestedAt,
  });
}
