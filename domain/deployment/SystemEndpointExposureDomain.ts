import type { DeploymentRecord } from "./DeploymentExecutionDomain";

export interface SystemEndpointId {
  readonly value: string;
}

export interface EndpointCallableMetadata {
  readonly protocol: "runtime-external-v1";
  readonly invocationMode: "sync" | "async";
  readonly contentType: string;
  readonly contractVersion: string;
}

export interface DeployedSystemEndpoint {
  readonly endpointId: SystemEndpointId;
  readonly endpointName: string;
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly deploymentEnvironmentId: string;
  readonly tenantId?: string;
  readonly callable: EndpointCallableMetadata;
}

export interface EndpointExposureRecord {
  readonly recordId: string;
  readonly endpoint: DeployedSystemEndpoint;
  readonly deploymentId: string;
  readonly rootSystemVersionId: string;
  readonly bundleId: string;
  readonly bundleVersionKey: string;
  readonly packageId: string;
  readonly deploymentConfigurationId: string;
  readonly activationUpdatedAt: string;
  readonly exposedAt: string;
  readonly updatedAt: string;
}

export interface ResolvedEndpointDeployment {
  readonly endpoint: DeployedSystemEndpoint;
  readonly deploymentId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly bundleId: string;
  readonly bundleVersionKey: string;
  readonly packageId: string;
  readonly deploymentConfigurationId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly deploymentEnvironmentId: string;
  readonly activationUpdatedAt: string;
}

