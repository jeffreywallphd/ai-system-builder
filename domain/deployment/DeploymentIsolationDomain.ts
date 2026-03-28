import { createHash } from "node:crypto";
import type { DeploymentRecord } from "./DeploymentExecutionDomain";

export interface DeploymentEnvironmentContext {
  readonly tenantId?: string;
  readonly deploymentEnvironmentId?: string;
  readonly targetId?: string;
  readonly targetType?: DeploymentRecord["targetType"];
  readonly source?: string;
  readonly callerId?: string;
  readonly sessionId?: string;
}

export interface DeploymentEnvironmentBoundary {
  readonly boundaryId: string;
  readonly deploymentEnvironmentId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly tenantId?: string;
}

export interface IsolatedDeploymentScope {
  readonly scopeId: string;
  readonly context: DeploymentEnvironmentContext;
  readonly boundary: DeploymentEnvironmentBoundary;
  readonly linkage: {
    readonly deploymentId: string;
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly bundleId: string;
    readonly bundleVersionKey: string;
    readonly packageId: string;
    readonly deploymentConfigurationId: string;
    readonly targetId: string;
    readonly targetType: DeploymentRecord["targetType"];
    readonly nestedSystemCount: number;
  };
  readonly runtimeBinding: {
    readonly runtimeTenantId?: string;
    readonly runtimeContextKey: string;
  };
}

export interface DeploymentIsolationPolicyDecision {
  readonly allowed: boolean;
  readonly reasonCode?:
    | "deployment-tenant-mismatch"
    | "deployment-environment-mismatch"
    | "deployment-target-mismatch"
    | "deployment-id-mismatch"
    | "missing-tenant-context";
  readonly message?: string;
}

export interface DeploymentIsolationPolicy {
  readonly policyId: string;
  evaluate(input: {
    readonly context: DeploymentEnvironmentContext;
    readonly scope: IsolatedDeploymentScope;
    readonly expectedDeploymentId?: string;
  }): DeploymentIsolationPolicyDecision;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function deriveDeploymentIsolationIds(input: {
  readonly deploymentId: string;
  readonly deploymentEnvironmentId: string;
  readonly targetId: string;
  readonly targetType: DeploymentRecord["targetType"];
  readonly tenantId?: string;
}): {
  readonly boundaryId: string;
  readonly scopeId: string;
  readonly runtimeContextKey: string;
} {
  const normalized = {
    deploymentId: input.deploymentId.trim(),
    deploymentEnvironmentId: input.deploymentEnvironmentId.trim(),
    targetId: input.targetId.trim(),
    targetType: input.targetType,
    tenantId: normalizeOptional(input.tenantId),
  };
  const boundaryHash = createHash("sha256")
    .update(JSON.stringify({
      deploymentEnvironmentId: normalized.deploymentEnvironmentId,
      targetId: normalized.targetId,
      targetType: normalized.targetType,
      tenantId: normalized.tenantId,
    }))
    .digest("hex")
    .slice(0, 20);
  const scopeHash = createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex")
    .slice(0, 20);

  return Object.freeze({
    boundaryId: `deployment-boundary:${normalized.targetType}:${boundaryHash}`,
    scopeId: `deployment-scope:${scopeHash}`,
    runtimeContextKey: [
      normalized.targetType,
      normalized.targetId,
      normalized.deploymentEnvironmentId,
      normalized.tenantId ?? "no-tenant",
    ].join(":"),
  });
}

export class StrictDeploymentIsolationPolicy implements DeploymentIsolationPolicy {
  public readonly policyId = "strict-deployment-isolation-v1";

  public evaluate(input: {
    readonly context: DeploymentEnvironmentContext;
    readonly scope: IsolatedDeploymentScope;
    readonly expectedDeploymentId?: string;
  }): DeploymentIsolationPolicyDecision {
    const callerTenantId = normalizeOptional(input.context.tenantId);
    const resourceTenantId = normalizeOptional(input.scope.boundary.tenantId);
    if (resourceTenantId && !callerTenantId) {
      return Object.freeze({
        allowed: false,
        reasonCode: "missing-tenant-context",
        message: "Deployment resource is tenant-scoped and requires a matching tenant context.",
      });
    }
    if (callerTenantId && resourceTenantId && callerTenantId !== resourceTenantId) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-tenant-mismatch",
        message: "Deployment resource tenant boundary does not match caller tenant context.",
      });
    }

    const requestedEnvironmentId = normalizeOptional(input.context.deploymentEnvironmentId);
    if (requestedEnvironmentId && requestedEnvironmentId !== input.scope.boundary.deploymentEnvironmentId) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-environment-mismatch",
        message: "Deployment resource environment boundary does not match requested environment context.",
      });
    }

    const requestedTargetId = normalizeOptional(input.context.targetId);
    if (requestedTargetId && requestedTargetId !== input.scope.boundary.targetId) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-target-mismatch",
        message: "Deployment resource target boundary does not match requested target context.",
      });
    }

    if (input.context.targetType && input.context.targetType !== input.scope.boundary.targetType) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-target-mismatch",
        message: "Deployment resource target type boundary does not match requested target context.",
      });
    }

    const expectedDeploymentId = normalizeOptional(input.expectedDeploymentId);
    if (expectedDeploymentId && expectedDeploymentId !== input.scope.linkage.deploymentId) {
      return Object.freeze({
        allowed: false,
        reasonCode: "deployment-id-mismatch",
        message: "Deployment resource does not match the requested deployment identity.",
      });
    }

    return Object.freeze({ allowed: true });
  }
}

