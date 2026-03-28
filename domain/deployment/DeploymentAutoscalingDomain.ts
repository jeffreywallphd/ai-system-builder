import type { DeploymentRecord } from "./DeploymentExecutionDomain";
import type { DeploymentHealthStatus } from "./DeploymentHealthDomain";

export const DeploymentScalingTriggerKinds = Object.freeze({
  cpuUtilization: "cpu-utilization",
  requestRate: "request-rate",
  latencyP95Ms: "latency-p95-ms",
  healthStatus: "health-status",
  manual: "manual",
} as const);

export type DeploymentScalingTriggerKind = typeof DeploymentScalingTriggerKinds[keyof typeof DeploymentScalingTriggerKinds];

export interface DeploymentScalingPolicy {
  readonly policyId: string;
  readonly policyName: string;
  readonly triggerKinds: ReadonlyArray<DeploymentScalingTriggerKind>;
  readonly cooldownSeconds: number;
  readonly targetUtilizationPercent?: number;
  readonly scaleOutStep?: number;
  readonly scaleInStep?: number;
  readonly healthSignalPolicy?: {
    readonly allowedStatuses: ReadonlyArray<DeploymentHealthStatus>;
    readonly maxConsecutiveDegradedSignals?: number;
  };
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface DeploymentScalingConfiguration {
  readonly configurationId: string;
  readonly deploymentId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly bundleId: string;
  readonly bundleVersionKey: string;
  readonly deploymentConfigurationId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly deploymentEnvironmentId?: string;
  readonly tenantId?: string;
  readonly nestedSystemCount: number;
  readonly minCapacity: number;
  readonly maxCapacity: number;
  readonly desiredCapacity: number;
  readonly policy: DeploymentScalingPolicy;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DeploymentScaleStatus {
  readonly deploymentId: string;
  readonly currentCapacity: number;
  readonly desiredCapacity: number;
  readonly minCapacity: number;
  readonly maxCapacity: number;
  readonly pendingActionCount: number;
  readonly lastActionAt?: string;
  readonly lastEvaluatedAt?: string;
  readonly lastDecisionDirection?: ScaleDirection;
  readonly summary: string;
}

export const ScaleDirections = Object.freeze({
  scaleOut: "scale-out",
  scaleIn: "scale-in",
  none: "none",
} as const);

export type ScaleDirection = typeof ScaleDirections[keyof typeof ScaleDirections];

export interface ScaleDecision {
  readonly decisionId: string;
  readonly deploymentId: string;
  readonly direction: ScaleDirection;
  readonly targetCapacity: number;
  readonly rationale: string;
  readonly inputSnapshot?: Readonly<Record<string, string>>;
  readonly decidedAt: string;
}

export const ScaleActionKinds = Object.freeze({
  manualAdjustment: "manual-adjustment",
  applyDecision: "apply-decision",
} as const);

export type ScaleActionKind = typeof ScaleActionKinds[keyof typeof ScaleActionKinds];

export const ScaleActionStatuses = Object.freeze({
  requested: "requested",
  rejected: "rejected",
} as const);

export type ScaleActionStatus = typeof ScaleActionStatuses[keyof typeof ScaleActionStatuses];

export interface ScaleActionRequest {
  readonly actionId: string;
  readonly deploymentId: string;
  readonly actionKind: ScaleActionKind;
  readonly requestedCapacity: number;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly status: ScaleActionStatus;
  readonly reason?: string;
  readonly decision?: ScaleDecision;
}

export function createDeploymentScalingPolicy(input: DeploymentScalingPolicy): DeploymentScalingPolicy {
  const policyId = input.policyId.trim();
  const policyName = input.policyName.trim();
  if (!policyId || !policyName) {
    throw new Error("Deployment scaling policy requires policyId and policyName.");
  }
  const triggerKinds = [...new Set(input.triggerKinds)].sort((left, right) => left.localeCompare(right));
  if (triggerKinds.length === 0) {
    throw new Error("Deployment scaling policy requires at least one trigger kind.");
  }
  if (input.cooldownSeconds < 0) {
    throw new Error("Deployment scaling policy cooldownSeconds must be non-negative.");
  }

  return Object.freeze({
    ...input,
    policyId,
    policyName,
    triggerKinds: Object.freeze(triggerKinds),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    healthSignalPolicy: input.healthSignalPolicy
      ? Object.freeze({
        ...input.healthSignalPolicy,
        allowedStatuses: Object.freeze([...new Set(input.healthSignalPolicy.allowedStatuses)]),
      })
      : undefined,
  });
}

export function createDeploymentScalingConfiguration(input: DeploymentScalingConfiguration): DeploymentScalingConfiguration {
  const configurationId = input.configurationId.trim();
  const deploymentId = input.deploymentId.trim();
  if (!configurationId || !deploymentId) {
    throw new Error("Deployment scaling configuration requires configurationId and deploymentId.");
  }
  if (input.minCapacity < 1) {
    throw new Error("Deployment scaling configuration minCapacity must be at least 1.");
  }
  if (input.maxCapacity < input.minCapacity) {
    throw new Error("Deployment scaling configuration maxCapacity must be greater than or equal to minCapacity.");
  }
  if (input.desiredCapacity < input.minCapacity || input.desiredCapacity > input.maxCapacity) {
    throw new Error("Deployment scaling configuration desiredCapacity must fall within min/max capacity bounds.");
  }

  return Object.freeze({
    ...input,
    configurationId,
    deploymentId,
    rootSystemAssetId: input.rootSystemAssetId.trim(),
    rootSystemVersionId: input.rootSystemVersionId.trim(),
    bundleId: input.bundleId.trim(),
    bundleVersionKey: input.bundleVersionKey.trim(),
    deploymentConfigurationId: input.deploymentConfigurationId.trim(),
    targetId: input.targetId.trim(),
    deploymentEnvironmentId: input.deploymentEnvironmentId?.trim() || undefined,
    tenantId: input.tenantId?.trim() || undefined,
    policy: createDeploymentScalingPolicy(input.policy),
    createdAt: input.createdAt.trim(),
    updatedAt: input.updatedAt.trim(),
  });
}

export function createScaleDecision(input: ScaleDecision): ScaleDecision {
  const decisionId = input.decisionId.trim();
  const deploymentId = input.deploymentId.trim();
  const rationale = input.rationale.trim();
  if (!decisionId || !deploymentId || !rationale) {
    throw new Error("Scale decision requires decisionId, deploymentId, and rationale.");
  }
  if (input.targetCapacity < 1) {
    throw new Error("Scale decision targetCapacity must be at least 1.");
  }
  return Object.freeze({
    ...input,
    decisionId,
    deploymentId,
    rationale,
    decidedAt: input.decidedAt.trim(),
    inputSnapshot: input.inputSnapshot ? Object.freeze({ ...input.inputSnapshot }) : undefined,
  });
}

export function createScaleActionRequest(input: ScaleActionRequest): ScaleActionRequest {
  const actionId = input.actionId.trim();
  const deploymentId = input.deploymentId.trim();
  const requestedBy = input.requestedBy.trim();
  const requestedAt = input.requestedAt.trim();
  if (!actionId || !deploymentId || !requestedBy || !requestedAt) {
    throw new Error("Scale action request requires actionId, deploymentId, requestedBy, and requestedAt.");
  }
  if (input.requestedCapacity < 1) {
    throw new Error("Scale action request requestedCapacity must be at least 1.");
  }

  return Object.freeze({
    ...input,
    actionId,
    deploymentId,
    requestedBy,
    requestedAt,
    reason: input.reason?.trim() || undefined,
    decision: input.decision ? createScaleDecision(input.decision) : undefined,
  });
}
