import type { ExecutionAccessContext } from "../system-runtime/RuntimeAccessControlService";

export const ExchangeAccessActions = Object.freeze({
  exportAtomic: "export-atomic",
  exportComposite: "export-composite",
  exportSystem: "export-system",
  importAtomic: "import-atomic",
  importComposite: "import-composite",
  importSystem: "import-system",
  createPublishablePackage: "create-publishable-package",
  managePublishablePackage: "manage-publishable-package",
});

export type ExchangeAccessAction = typeof ExchangeAccessActions[keyof typeof ExchangeAccessActions];

export interface ExchangeAccessContext {
  readonly caller?: ExecutionAccessContext;
  readonly tenantId?: string;
  readonly source?: string;
}

export interface ExchangeAccessRequest {
  readonly action: ExchangeAccessAction;
  readonly context?: ExchangeAccessContext;
  readonly sourceAssetId?: string;
  readonly sourceVersionId?: string;
  readonly bundleId?: string;
  readonly packageId?: string;
  readonly resourceTenantId?: string;
}

export interface ExchangeAccessDecision {
  readonly allowed: boolean;
  readonly reasonCode?:
    | "missing-caller-context"
    | "missing-caller-identity"
    | "tenant-mismatch"
    | "missing-role";
  readonly message?: string;
  readonly policyId: string;
  readonly context: {
    readonly action: ExchangeAccessAction;
    readonly callerKind?: string;
    readonly callerId?: string;
    readonly tenantId?: string;
    readonly sourceAssetId?: string;
    readonly sourceVersionId?: string;
    readonly bundleId?: string;
    readonly packageId?: string;
  };
}

export interface ExchangeAccessPolicy {
  readonly policyId: string;
  evaluate(request: ExchangeAccessRequest): ExchangeAccessDecision;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeContext(context?: ExchangeAccessContext): ExchangeAccessContext | undefined {
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

export class AllowAllExchangeAccessPolicy implements ExchangeAccessPolicy {
  public readonly policyId = "allow-all-exchange-access";

  public evaluate(request: ExchangeAccessRequest): ExchangeAccessDecision {
    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
      context: Object.freeze({
        action: request.action,
        callerKind: request.context?.caller?.callerKind,
        callerId: request.context?.caller?.callerId,
        tenantId: request.context?.tenantId,
        sourceAssetId: request.sourceAssetId,
        sourceVersionId: request.sourceVersionId,
        bundleId: request.bundleId,
        packageId: request.packageId,
      }),
    });
  }
}

const DEFAULT_RULES: Readonly<Record<ExchangeAccessAction, ReadonlyArray<string>>> = Object.freeze({
  [ExchangeAccessActions.exportAtomic]: Object.freeze(["exchange-admin", "exchange-exporter"]),
  [ExchangeAccessActions.exportComposite]: Object.freeze(["exchange-admin", "exchange-exporter"]),
  [ExchangeAccessActions.exportSystem]: Object.freeze(["exchange-admin", "exchange-exporter"]),
  [ExchangeAccessActions.importAtomic]: Object.freeze(["exchange-admin", "exchange-importer"]),
  [ExchangeAccessActions.importComposite]: Object.freeze(["exchange-admin", "exchange-importer"]),
  [ExchangeAccessActions.importSystem]: Object.freeze(["exchange-admin", "exchange-importer"]),
  [ExchangeAccessActions.createPublishablePackage]: Object.freeze(["exchange-admin", "exchange-publisher"]),
  [ExchangeAccessActions.managePublishablePackage]: Object.freeze(["exchange-admin", "exchange-publisher"]),
});

export class RoleBasedExchangeAccessPolicy implements ExchangeAccessPolicy {
  public readonly policyId = "role-based-exchange-access-v1";

  public constructor(private readonly allowedRolesByAction: Readonly<Record<ExchangeAccessAction, ReadonlyArray<string>>> = DEFAULT_RULES) {}

  public evaluate(input: ExchangeAccessRequest): ExchangeAccessDecision {
    const request = Object.freeze({
      ...input,
      context: normalizeContext(input.context),
      sourceAssetId: normalizeOptional(input.sourceAssetId),
      sourceVersionId: normalizeOptional(input.sourceVersionId),
      bundleId: normalizeOptional(input.bundleId),
      packageId: normalizeOptional(input.packageId),
      resourceTenantId: normalizeOptional(input.resourceTenantId),
    });

    const context = this.toDecisionContext(request);
    const caller = request.context?.caller;
    if (!caller) {
      return this.denied("missing-caller-context", "Exchange operation requires an authenticated caller context.", context);
    }

    if (!caller.callerId) {
      return this.denied("missing-caller-identity", "Exchange operation requires a caller identity.", context);
    }

    if (request.context?.tenantId && request.resourceTenantId && request.context.tenantId !== request.resourceTenantId) {
      return this.denied("tenant-mismatch", "Exchange operation tenant context does not match resource tenant.", context);
    }

    const allowedRoles = this.allowedRolesByAction[request.action] ?? Object.freeze([]);
    const roleSet = new Set((caller.roles ?? []).map((entry) => entry.toLowerCase()));
    const hasAllowedRole = allowedRoles.some((role) => roleSet.has(role.toLowerCase()));
    if (!hasAllowedRole) {
      return this.denied("missing-role", `Exchange operation '${request.action}' requires one of roles: ${allowedRoles.join(", ")}.`, context);
    }

    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
      context,
    });
  }

  private denied(
    reasonCode: NonNullable<ExchangeAccessDecision["reasonCode"]>,
    message: string,
    context: ExchangeAccessDecision["context"],
  ): ExchangeAccessDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      policyId: this.policyId,
      context,
    });
  }

  private toDecisionContext(request: ExchangeAccessRequest): ExchangeAccessDecision["context"] {
    return Object.freeze({
      action: request.action,
      callerKind: request.context?.caller?.callerKind,
      callerId: request.context?.caller?.callerId,
      tenantId: request.context?.tenantId,
      sourceAssetId: request.sourceAssetId,
      sourceVersionId: request.sourceVersionId,
      bundleId: request.bundleId,
      packageId: request.packageId,
    });
  }
}

export class ExchangeAccessDeniedError extends Error {
  public constructor(public readonly decision: ExchangeAccessDecision) {
    super(`forbidden:${decision.message ?? "Exchange access denied."}`);
    this.name = "ExchangeAccessDeniedError";
  }
}

export class ExchangeAccessEvaluator {
  public constructor(private readonly policy: ExchangeAccessPolicy = new AllowAllExchangeAccessPolicy()) {}

  public evaluate(request: ExchangeAccessRequest): ExchangeAccessDecision {
    const decision = this.policy.evaluate(request);
    return Object.freeze({
      ...decision,
      policyId: normalizeOptional(decision.policyId) ?? this.policy.policyId,
    });
  }

  public assertAllowed(request: ExchangeAccessRequest): ExchangeAccessDecision {
    const decision = this.evaluate(request);
    if (!decision.allowed) {
      throw new ExchangeAccessDeniedError(decision);
    }
    return decision;
  }
}
