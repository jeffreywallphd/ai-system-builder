import type { DeploymentRecord } from "@domain/deployment/DeploymentExecutionDomain";
import type { DeploymentAccessContext } from "./DeploymentAccessControl";

export const DeploymentQuotaActions = Object.freeze({
  executeDeployment: "execute-deployment",
  changeActiveDeployment: "change-active-deployment",
  rollbackDeployment: "rollback-deployment",
});

export type DeploymentQuotaAction = typeof DeploymentQuotaActions[keyof typeof DeploymentQuotaActions];

export interface DeploymentQuotaPolicy {
  readonly maxDeploymentsPerCallerPerWindow: number;
  readonly maxDeploymentsPerTargetPerWindow: number;
  readonly maxActivationChangesPerTargetPerWindow: number;
  readonly maxRollbacksPerTargetPerWindow: number;
  readonly windowMs: number;
}

export interface DeploymentQuotaEvaluationRequest {
  readonly action: DeploymentQuotaAction;
  readonly accessContext?: DeploymentAccessContext;
  readonly rootSystemAssetId?: string;
  readonly rootSystemVersionId?: string;
  readonly targetId?: string;
  readonly targetType?: DeploymentRecord["targetType"];
  readonly now?: Date;
}

export interface DeploymentQuotaDecision {
  readonly allowed: boolean;
  readonly reasonCode?:
    | "deployment-caller-window-exceeded"
    | "deployment-target-window-exceeded"
    | "activation-target-window-exceeded"
    | "rollback-target-window-exceeded";
  readonly message?: string;
  readonly policyId: string;
  readonly snapshot: {
    readonly action: DeploymentQuotaAction;
    readonly callerKey: string;
    readonly targetKey: string;
    readonly callerCount: number;
    readonly targetCount: number;
    readonly limit: number;
    readonly windowMs: number;
    readonly rootSystemAssetId?: string;
    readonly rootSystemVersionId?: string;
    readonly targetId?: string;
    readonly targetType?: DeploymentRecord["targetType"];
  };
}

interface SlidingWindowCounter {
  readonly timestampsMs: number[];
}

const DEFAULT_POLICY: DeploymentQuotaPolicy = Object.freeze({
  maxDeploymentsPerCallerPerWindow: 10,
  maxDeploymentsPerTargetPerWindow: 25,
  maxActivationChangesPerTargetPerWindow: 30,
  maxRollbacksPerTargetPerWindow: 10,
  windowMs: 300_000,
});

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createCallerKey(context?: DeploymentAccessContext): string {
  const caller = context?.caller;
  const callerKind = caller?.callerKind ?? "anonymous";
  const callerId = normalizeOptional(caller?.callerId) ?? "unknown";
  const tenantId = normalizeOptional(context?.tenantId) ?? "no-tenant";
  const sessionId = normalizeOptional(caller?.sessionId) ?? "no-session";
  return `${callerKind}:${callerId}:${tenantId}:${sessionId}`;
}

function createTargetKey(request: DeploymentQuotaEvaluationRequest): string {
  const tenantId = normalizeOptional(request.accessContext?.tenantId) ?? "no-tenant";
  const system = normalizeOptional(request.rootSystemAssetId) ?? "unknown-system";
  const targetId = normalizeOptional(request.targetId) ?? "unknown-target";
  const targetType = normalizeOptional(request.targetType) ?? "unknown-type";
  return `${tenantId}:${system}:${targetType}:${targetId}`;
}

function limitForAction(policy: DeploymentQuotaPolicy, action: DeploymentQuotaAction): { readonly limit: number; readonly reasonCode: NonNullable<DeploymentQuotaDecision["reasonCode"]> } {
  switch (action) {
    case DeploymentQuotaActions.executeDeployment:
      return { limit: policy.maxDeploymentsPerTargetPerWindow, reasonCode: "deployment-target-window-exceeded" };
    case DeploymentQuotaActions.changeActiveDeployment:
      return { limit: policy.maxActivationChangesPerTargetPerWindow, reasonCode: "activation-target-window-exceeded" };
    case DeploymentQuotaActions.rollbackDeployment:
      return { limit: policy.maxRollbacksPerTargetPerWindow, reasonCode: "rollback-target-window-exceeded" };
    default:
      return { limit: policy.maxDeploymentsPerTargetPerWindow, reasonCode: "deployment-target-window-exceeded" };
  }
}

export class DeploymentQuotaExceededError extends Error {
  public constructor(public readonly decision: DeploymentQuotaDecision) {
    super(`quota-exceeded:${decision.message ?? "Deployment quota exceeded."}`);
    this.name = "DeploymentQuotaExceededError";
  }
}

export class DeploymentQuotaEvaluator {
  private readonly callerCountersByAction = new Map<DeploymentQuotaAction, Map<string, SlidingWindowCounter>>();
  private readonly targetCountersByAction = new Map<DeploymentQuotaAction, Map<string, SlidingWindowCounter>>();

  public constructor(
    private readonly policy: DeploymentQuotaPolicy = DEFAULT_POLICY,
    private readonly policyId = "bounded-deployment-quota-v1",
  ) {}

  public evaluate(request: DeploymentQuotaEvaluationRequest): DeploymentQuotaDecision {
    const nowMs = (request.now ?? new Date()).getTime();
    const callerKey = createCallerKey(request.accessContext);
    const targetKey = createTargetKey(request);

    const callerCounter = this.ensureCounter(this.callerCountersByAction, request.action, callerKey, nowMs);
    const targetCounter = this.ensureCounter(this.targetCountersByAction, request.action, targetKey, nowMs);

    if (request.action === DeploymentQuotaActions.executeDeployment && callerCounter.timestampsMs.length >= this.policy.maxDeploymentsPerCallerPerWindow) {
      return this.denied(
        "deployment-caller-window-exceeded",
        `Deployment quota exceeded: at most ${this.policy.maxDeploymentsPerCallerPerWindow} deployment(s) per caller are allowed every ${this.policy.windowMs}ms.`,
        request,
        callerKey,
        targetKey,
        callerCounter,
        targetCounter,
        this.policy.maxDeploymentsPerCallerPerWindow,
      );
    }

    const scoped = limitForAction(this.policy, request.action);
    if (targetCounter.timestampsMs.length >= scoped.limit) {
      return this.denied(
        scoped.reasonCode,
        `Deployment quota exceeded: action '${request.action}' is limited to ${scoped.limit} request(s) per target scope every ${this.policy.windowMs}ms.`,
        request,
        callerKey,
        targetKey,
        callerCounter,
        targetCounter,
        scoped.limit,
      );
    }

    callerCounter.timestampsMs.push(nowMs);
    targetCounter.timestampsMs.push(nowMs);

    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
      snapshot: this.snapshot(request, callerKey, targetKey, callerCounter, targetCounter, scoped.limit),
    });
  }

  public assertAllowed(request: DeploymentQuotaEvaluationRequest): DeploymentQuotaDecision {
    const decision = this.evaluate(request);
    if (!decision.allowed) {
      throw new DeploymentQuotaExceededError(decision);
    }
    return decision;
  }

  private ensureCounter(
    mapByAction: Map<DeploymentQuotaAction, Map<string, SlidingWindowCounter>>,
    action: DeploymentQuotaAction,
    key: string,
    nowMs: number,
  ): SlidingWindowCounter {
    const map = mapByAction.get(action) ?? new Map<string, SlidingWindowCounter>();
    mapByAction.set(action, map);

    const existing = map.get(key);
    if (existing) {
      this.prune(existing, nowMs);
      return existing;
    }

    const created: SlidingWindowCounter = { timestampsMs: [] };
    map.set(key, created);
    return created;
  }

  private prune(counter: SlidingWindowCounter, nowMs: number): void {
    const threshold = nowMs - this.policy.windowMs;
    const retained = counter.timestampsMs.filter((value) => value >= threshold);
    counter.timestampsMs.splice(0, counter.timestampsMs.length, ...retained);
  }

  private denied(
    reasonCode: NonNullable<DeploymentQuotaDecision["reasonCode"]>,
    message: string,
    request: DeploymentQuotaEvaluationRequest,
    callerKey: string,
    targetKey: string,
    callerCounter: SlidingWindowCounter,
    targetCounter: SlidingWindowCounter,
    limit: number,
  ): DeploymentQuotaDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      policyId: this.policyId,
      snapshot: this.snapshot(request, callerKey, targetKey, callerCounter, targetCounter, limit),
    });
  }

  private snapshot(
    request: DeploymentQuotaEvaluationRequest,
    callerKey: string,
    targetKey: string,
    callerCounter: SlidingWindowCounter,
    targetCounter: SlidingWindowCounter,
    limit: number,
  ): DeploymentQuotaDecision["snapshot"] {
    return Object.freeze({
      action: request.action,
      callerKey,
      targetKey,
      callerCount: callerCounter.timestampsMs.length,
      targetCount: targetCounter.timestampsMs.length,
      limit,
      windowMs: this.policy.windowMs,
      rootSystemAssetId: normalizeOptional(request.rootSystemAssetId),
      rootSystemVersionId: normalizeOptional(request.rootSystemVersionId),
      targetId: normalizeOptional(request.targetId),
      targetType: request.targetType,
    });
  }
}

