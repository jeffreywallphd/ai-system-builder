import type { DeploymentRecord } from "./DeploymentExecutionDomain";

export interface RollbackRequest {
  readonly requestId: string;
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly toDeploymentId?: string;
  readonly reason?: string;
}

export interface RollbackDecision {
  readonly eligible: boolean;
  readonly code:
    | "eligible"
    | "no-active-deployment"
    | "target-mismatch"
    | "candidate-not-found"
    | "candidate-not-eligible"
    | "already-active";
  readonly message: string;
}

export interface RollbackResult {
  readonly requestId: string;
  readonly performed: boolean;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly fromDeploymentId?: string;
  readonly toDeploymentId?: string;
  readonly decision: RollbackDecision;
  readonly actionId: string;
}

export interface RollbackActionRecord {
  readonly actionId: string;
  readonly requestId: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly fromDeploymentId?: string;
  readonly toDeploymentId?: string;
  readonly performed: boolean;
  readonly decision: RollbackDecision;
}
