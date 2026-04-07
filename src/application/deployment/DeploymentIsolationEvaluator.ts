import {
  type DeploymentEnvironmentContext,
  type DeploymentIsolationPolicy,
  StrictDeploymentIsolationPolicy,
} from "@domain/deployment/DeploymentIsolationDomain";
import type { DeploymentRecord } from "@domain/deployment/DeploymentExecutionDomain";

export class DeploymentIsolationDeniedError extends Error {
  public constructor(
    public readonly decision: {
      readonly allowed: false;
      readonly reasonCode?: string;
      readonly message?: string;
      readonly deploymentId: string;
      readonly policyId: string;
    },
  ) {
    super(`forbidden:${decision.message ?? "Deployment isolation policy denied access."}`);
    this.name = "DeploymentIsolationDeniedError";
  }
}

function normalizeContext(context?: DeploymentEnvironmentContext): DeploymentEnvironmentContext {
  return Object.freeze({
    tenantId: context?.tenantId?.trim() || undefined,
    deploymentEnvironmentId: context?.deploymentEnvironmentId?.trim() || undefined,
    targetId: context?.targetId?.trim() || undefined,
    targetType: context?.targetType,
    source: context?.source?.trim() || undefined,
    callerId: context?.callerId?.trim() || undefined,
    sessionId: context?.sessionId?.trim() || undefined,
  });
}

export class DeploymentIsolationEvaluator {
  public constructor(private readonly policy: DeploymentIsolationPolicy = new StrictDeploymentIsolationPolicy()) {}

  public assertRecordAccessible(input: {
    readonly record: DeploymentRecord;
    readonly context?: DeploymentEnvironmentContext;
    readonly expectedDeploymentId?: string;
  }): void {
    const decision = this.policy.evaluate({
      context: normalizeContext(input.context),
      scope: input.record.isolation,
      expectedDeploymentId: input.expectedDeploymentId,
    });
    if (!decision.allowed) {
      throw new DeploymentIsolationDeniedError({
        allowed: false,
        reasonCode: decision.reasonCode,
        message: decision.message,
        deploymentId: input.record.deploymentId,
        policyId: this.policy.policyId,
      });
    }
  }

  public filterRecords(input: {
    readonly records: ReadonlyArray<DeploymentRecord>;
    readonly context?: DeploymentEnvironmentContext;
  }): ReadonlyArray<DeploymentRecord> {
    const context = normalizeContext(input.context);
    return Object.freeze(input.records.filter((record) => this.policy.evaluate({
      context,
      scope: record.isolation,
    }).allowed));
  }
}


