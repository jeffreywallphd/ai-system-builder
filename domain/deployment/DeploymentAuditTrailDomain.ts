import type { DeploymentRecord } from "./DeploymentExecutionDomain";

export const DeploymentAuditEventKinds = Object.freeze({
  deploymentRequested: "deployment-requested",
  deploymentSucceeded: "deployment-succeeded",
  deploymentRejected: "deployment-rejected",
  activationChanged: "activation-changed",
  rollbackRequested: "rollback-requested",
  rollbackCompleted: "rollback-completed",
  rollbackRejected: "rollback-rejected",
  scalingConfigurationChanged: "scaling-configuration-changed",
  scaleActionRequested: "scale-action-requested",
} as const);

export type DeploymentAuditEventKind = typeof DeploymentAuditEventKinds[keyof typeof DeploymentAuditEventKinds];

export const DeploymentAuditOutcomes = Object.freeze({
  accepted: "accepted",
  succeeded: "succeeded",
  rejected: "rejected",
} as const);

export type DeploymentAuditOutcome = typeof DeploymentAuditOutcomes[keyof typeof DeploymentAuditOutcomes];

export interface DeploymentAuditRecord {
  readonly auditId: string;
  readonly occurredAt: string;
  readonly eventKind: DeploymentAuditEventKind;
  readonly outcome: DeploymentAuditOutcome;
  readonly requestSource: "deployment-api" | "external-api" | "studio-shell-internal" | "internal-trusted" | "unknown";
  readonly caller: {
    readonly callerKind?: string;
    readonly callerId?: string;
    readonly sessionId?: string;
    readonly roles?: ReadonlyArray<string>;
    readonly authenticatedPrincipalId?: string;
  };
  readonly tenant: {
    readonly tenantId?: string;
    readonly source?: string;
  };
  readonly deployment: {
    readonly deploymentId?: string;
    readonly requestId?: string;
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId?: string;
    readonly bundleId?: string;
    readonly bundleVersionKey?: string;
    readonly deploymentConfigurationId?: string;
    readonly targetId?: string;
    readonly targetType?: DeploymentRecord["targetType"];
    readonly deploymentEnvironmentId?: string;
  };
  readonly metadata?: Readonly<Record<string, string>>;
  readonly detail?: {
    readonly message?: string;
    readonly errorCode?: string;
    readonly relatedDeploymentId?: string;
  };
}

export function createDeploymentAuditRecord(input: Omit<DeploymentAuditRecord, "auditId" | "occurredAt"> & {
  readonly auditId?: string;
  readonly occurredAt?: string;
}): DeploymentAuditRecord {
  const occurredAt = input.occurredAt?.trim() || new Date().toISOString();
  const auditId = input.auditId?.trim() || `deploy-audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  if (!input.deployment.rootSystemAssetId.trim()) {
    throw new Error("Deployment audit record requires deployment.rootSystemAssetId.");
  }

  return Object.freeze({
    ...input,
    auditId,
    occurredAt,
    caller: Object.freeze({
      ...input.caller,
      callerKind: input.caller.callerKind?.trim() || undefined,
      callerId: input.caller.callerId?.trim() || undefined,
      sessionId: input.caller.sessionId?.trim() || undefined,
      authenticatedPrincipalId: input.caller.authenticatedPrincipalId?.trim() || undefined,
      roles: input.caller.roles ? Object.freeze([...new Set(input.caller.roles)].sort((left, right) => left.localeCompare(right))) : undefined,
    }),
    tenant: Object.freeze({
      tenantId: input.tenant.tenantId?.trim() || undefined,
      source: input.tenant.source?.trim() || undefined,
    }),
    deployment: Object.freeze({
      ...input.deployment,
      deploymentId: input.deployment.deploymentId?.trim() || undefined,
      requestId: input.deployment.requestId?.trim() || undefined,
      rootSystemAssetId: input.deployment.rootSystemAssetId.trim(),
      rootSystemVersionId: input.deployment.rootSystemVersionId?.trim() || undefined,
      bundleId: input.deployment.bundleId?.trim() || undefined,
      bundleVersionKey: input.deployment.bundleVersionKey?.trim() || undefined,
      deploymentConfigurationId: input.deployment.deploymentConfigurationId?.trim() || undefined,
      targetId: input.deployment.targetId?.trim() || undefined,
      deploymentEnvironmentId: input.deployment.deploymentEnvironmentId?.trim() || undefined,
    }),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    detail: input.detail ? Object.freeze({ ...input.detail }) : undefined,
  });
}
