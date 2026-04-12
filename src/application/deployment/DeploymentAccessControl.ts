import type { ExecutionAccessContext } from "../system-runtime/RuntimeAccessControlService";
import type { DeploymentRecord } from "@domain/deployment/DeploymentExecutionDomain";

export const DeploymentAccessActions = Object.freeze({
  executeDeployment: "execute-deployment",
  changeActiveDeployment: "change-active-deployment",
  rollbackDeployment: "rollback-deployment",
  readDeploymentHistory: "read-deployment-history",
  readDeploymentDetails: "read-deployment-details",
});

export type DeploymentAccessAction = typeof DeploymentAccessActions[keyof typeof DeploymentAccessActions];

export interface DeploymentAccessContext {
  readonly caller?: ExecutionAccessContext;
  readonly tenantId?: string;
  readonly source?: string;
}

export interface DeploymentAccessRequest {
  readonly action: DeploymentAccessAction;
  readonly context?: DeploymentAccessContext;
  readonly rootSystemAssetId?: string;
  readonly rootSystemVersionId?: string;
  readonly deploymentId?: string;
  readonly targetId?: string;
  readonly targetType?: DeploymentRecord["targetType"];
  readonly resourceTenantId?: string;
}

export interface DeploymentAccessDecision {
  readonly allowed: boolean;
  readonly reasonCode?:
    | "missing-caller-context"
    | "missing-caller-identity"
    | "missing-role"
    | "tenant-mismatch";
  readonly message?: string;
  readonly policyId: string;
  readonly context: {
    readonly action: DeploymentAccessAction;
    readonly callerKind?: string;
    readonly callerId?: string;
    readonly tenantId?: string;
    readonly targetId?: string;
    readonly targetType?: DeploymentRecord["targetType"];
    readonly rootSystemAssetId?: string;
    readonly rootSystemVersionId?: string;
    readonly deploymentId?: string;
  };
}

export interface DeploymentAccessPolicy {
  readonly policyId: string;
  evaluate(request: DeploymentAccessRequest): DeploymentAccessDecision;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeContext(context?: DeploymentAccessContext): DeploymentAccessContext | undefined {
  if (!context) {
    return undefined;
  }

  const caller = context.caller
    ? Object.freeze({
      callerKind: context.caller.callerKind,
      callerId: normalizeOptional(context.caller.callerId),
      sessionId: normalizeOptional(context.caller.sessionId),
      roles: context.caller.roles
        ? Object.freeze([...new Set(context.caller.roles.map((entry) => entry.trim()).filter(Boolean))])
        : undefined,
      metadata: context.caller.metadata ? Object.freeze({ ...context.caller.metadata }) : undefined,
    })
    : undefined;

  return Object.freeze({
    caller,
    tenantId: normalizeOptional(context.tenantId),
    source: normalizeOptional(context.source),
  });
}

export class AllowAllDeploymentAccessPolicy implements DeploymentAccessPolicy {
  public readonly policyId = "allow-all-deployment-access";

  public evaluate(request: DeploymentAccessRequest): DeploymentAccessDecision {
    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
      context: Object.freeze({
        action: request.action,
        callerKind: request.context?.caller?.callerKind,
        callerId: request.context?.caller?.callerId,
        tenantId: request.context?.tenantId,
        targetId: request.targetId,
        targetType: request.targetType,
        rootSystemAssetId: request.rootSystemAssetId,
        rootSystemVersionId: request.rootSystemVersionId,
        deploymentId: request.deploymentId,
      }),
    });
  }
}

const DEFAULT_RULES: Readonly<Record<DeploymentAccessAction, ReadonlyArray<string>>> = Object.freeze({
  [DeploymentAccessActions.executeDeployment]: Object.freeze(["deployment-admin", "deployer"]),
  [DeploymentAccessActions.changeActiveDeployment]: Object.freeze(["deployment-admin", "deployment-manager"]),
  [DeploymentAccessActions.rollbackDeployment]: Object.freeze(["deployment-admin", "deployment-rollback"]),
  [DeploymentAccessActions.readDeploymentHistory]: Object.freeze(["deployment-admin", "deployment-viewer", "deployer", "deployment-manager", "deployment-rollback"]),
  [DeploymentAccessActions.readDeploymentDetails]: Object.freeze(["deployment-admin", "deployment-viewer", "deployer", "deployment-manager", "deployment-rollback"]),
});

export class RoleBasedDeploymentAccessPolicy implements DeploymentAccessPolicy {
  public readonly policyId = "role-based-deployment-access-v1";

  public constructor(private readonly allowedRolesByAction: Readonly<Record<DeploymentAccessAction, ReadonlyArray<string>>> = DEFAULT_RULES) {}

  public evaluate(input: DeploymentAccessRequest): DeploymentAccessDecision {
    const request = Object.freeze({
      ...input,
      context: normalizeContext(input.context),
      rootSystemAssetId: normalizeOptional(input.rootSystemAssetId),
      rootSystemVersionId: normalizeOptional(input.rootSystemVersionId),
      deploymentId: normalizeOptional(input.deploymentId),
      targetId: normalizeOptional(input.targetId),
      resourceTenantId: normalizeOptional(input.resourceTenantId),
    });

    const context = this.decisionContext(request);
    const caller = request.context?.caller;
    if (!caller) {
      return this.denied("missing-caller-context", "Deployment operation requires an authenticated caller context.", context);
    }

    if (!caller.callerId) {
      return this.denied("missing-caller-identity", "Deployment operation requires a caller identity.", context);
    }

    if (request.context?.tenantId && request.resourceTenantId && request.context.tenantId !== request.resourceTenantId) {
      return this.denied("tenant-mismatch", "Deployment operation tenant context does not match the deployment resource tenant.", context);
    }

    const allowedRoles = this.allowedRolesByAction[request.action] ?? Object.freeze([]);
    const roleSet = new Set((caller.roles ?? []).map((entry) => entry.toLowerCase()));
    const hasAllowedRole = allowedRoles.some((role) => roleSet.has(role.toLowerCase()));
    if (!hasAllowedRole) {
      return this.denied(
        "missing-role",
        `Deployment operation '${request.action}' requires one of roles: ${allowedRoles.join(", ")}.`,
        context,
      );
    }

    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
      context,
    });
  }

  private denied(
    reasonCode: NonNullable<DeploymentAccessDecision["reasonCode"]>,
    message: string,
    context: DeploymentAccessDecision["context"],
  ): DeploymentAccessDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      policyId: this.policyId,
      context,
    });
  }

  private decisionContext(request: DeploymentAccessRequest): DeploymentAccessDecision["context"] {
    return Object.freeze({
      action: request.action,
      callerKind: request.context?.caller?.callerKind,
      callerId: request.context?.caller?.callerId,
      tenantId: request.context?.tenantId,
      targetId: request.targetId,
      targetType: request.targetType,
      rootSystemAssetId: request.rootSystemAssetId,
      rootSystemVersionId: request.rootSystemVersionId,
      deploymentId: request.deploymentId,
    });
  }
}

export class DeploymentAccessDeniedError extends Error {
  public constructor(public readonly decision: DeploymentAccessDecision) {
    super(`forbidden:${decision.message ?? "Deployment access denied."}`);
    this.name = "DeploymentAccessDeniedError";
  }
}

export class DeploymentAccessEvaluator {
  public constructor(private readonly policy: DeploymentAccessPolicy = new AllowAllDeploymentAccessPolicy()) {}

  public evaluate(request: DeploymentAccessRequest): DeploymentAccessDecision {
    const decision = this.policy.evaluate(request);
    return Object.freeze({
      ...decision,
      policyId: normalizeOptional(decision.policyId) ?? this.policy.policyId,
    });
  }

  public assertAllowed(request: DeploymentAccessRequest): DeploymentAccessDecision {
    const decision = this.evaluate(request);
    if (!decision.allowed) {
      throw new DeploymentAccessDeniedError(decision);
    }
    return decision;
  }
}

