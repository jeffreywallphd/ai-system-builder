import type { DeploymentActivationState, DeploymentStatus } from "./DeploymentExecutionDomain";
import type { DeploymentState } from "./DeploymentStateDomain";

export const DeploymentHealthStatuses = Object.freeze({
  healthy: "healthy",
  degraded: "degraded",
  unhealthy: "unhealthy",
  pending: "pending",
  unknown: "unknown",
} as const);

export type DeploymentHealthStatus = typeof DeploymentHealthStatuses[keyof typeof DeploymentHealthStatuses];

export interface DeploymentHealthSignalSnapshot {
  readonly deploymentStatus: DeploymentStatus;
  readonly deploymentState: DeploymentState;
  readonly activationState: DeploymentActivationState;
  readonly diagnosticErrorCount: number;
  readonly diagnosticWarningCount: number;
  readonly endpointExposureCount: number;
  readonly endpointResolvableCount: number;
}

export interface DeploymentHealthSnapshot {
  readonly deploymentId: string;
  readonly status: DeploymentHealthStatus;
  readonly evaluatedAt: string;
  readonly reasons: ReadonlyArray<string>;
  readonly linkage: {
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly targetId: string;
    readonly targetType: "local" | "cloud" | "edge";
    readonly deploymentEnvironmentId?: string;
    readonly endpointIds: ReadonlyArray<string>;
    readonly activeDeploymentId?: string;
    readonly nestedSystemCount: number;
    readonly tenantId?: string;
  };
  readonly signals: DeploymentHealthSignalSnapshot;
}
