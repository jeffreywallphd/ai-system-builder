import type {
  AuthorizationActorReference,
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
  AuthorizationPolicyDecisionDenialReason,
} from "../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationPolicyDecisionDenialReasons,
  AuthorizationPolicyEvaluationTargetKinds,
} from "../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../../../src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { AuthorizationResourceFamily } from "../../../src/domain/authorization/AuthorizationPermissionCatalog";

export const AuthorizationTransportFailureCodes = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  invalidRequest: "invalid-request",
  internal: "internal",
});

export type AuthorizationTransportFailureCode =
  typeof AuthorizationTransportFailureCodes[keyof typeof AuthorizationTransportFailureCodes];

export interface AuthorizationTransportFailure {
  readonly code: AuthorizationTransportFailureCode;
  readonly message: string;
  readonly reasonCode?: string;
  readonly denialReason?: AuthorizationPolicyDecisionDenialReason;
}

export interface AuthorizationTransportGuardAllowed {
  readonly ok: true;
  readonly decision: AuthorizationPolicyDecisionEvaluationResult["decision"];
  readonly debug?: AuthorizationPolicyDecisionEvaluationResult["debug"];
}

export interface AuthorizationTransportGuardDenied {
  readonly ok: false;
  readonly failure: AuthorizationTransportFailure;
}

export type AuthorizationTransportGuardResult = AuthorizationTransportGuardAllowed | AuthorizationTransportGuardDenied;

type ContextValueResolver<TContext, TValue> = TValue | ((context: TContext) => TValue);

interface AuthorizationResourceInstanceRequirementTarget<TContext> {
  readonly kind: typeof AuthorizationPolicyEvaluationTargetKinds.resourceInstance;
  readonly resourceFamily: ContextValueResolver<TContext, AuthorizationResourceFamily>;
  readonly resourceType: ContextValueResolver<TContext, string>;
  readonly resourceId: ContextValueResolver<TContext, string>;
}

interface AuthorizationWorkspaceCapabilityRequirementTarget<TContext> {
  readonly kind: typeof AuthorizationPolicyEvaluationTargetKinds.workspaceCapability;
  readonly workspaceId: ContextValueResolver<TContext, string>;
  readonly capabilityResourceType: ContextValueResolver<TContext, string>;
}

export type AuthorizationTransportRequirementTarget<TContext> =
  | AuthorizationResourceInstanceRequirementTarget<TContext>
  | AuthorizationWorkspaceCapabilityRequirementTarget<TContext>;

export interface AuthorizationTransportRequirement<TContext> {
  readonly requiredPermissionKey: ContextValueResolver<TContext, string>;
  readonly target: AuthorizationTransportRequirementTarget<TContext>;
  readonly asOf?: ContextValueResolver<TContext, string | undefined>;
  readonly includeDebugDetails?: boolean;
}

export interface AuthorizationTransportPolicyGuardDependencies<TContext> {
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly resolveActor: (context: TContext) => AuthorizationActorReference | undefined;
}

export class AuthorizationTransportPolicyGuard<TContext> {
  public constructor(private readonly dependencies: AuthorizationTransportPolicyGuardDependencies<TContext>) {}

  public async authorize(
    context: TContext,
    requirement: AuthorizationTransportRequirement<TContext>,
  ): Promise<AuthorizationTransportGuardResult> {
    try {
      const actor = this.dependencies.resolveActor(context);
      const actorUserIdentityId = normalizeOptional(actor?.actorUserIdentityId);
      const actorServiceId = normalizeOptional(actor?.actorServiceId);
      if (!actorUserIdentityId && !actorServiceId) {
        return this.denied({
          code: AuthorizationTransportFailureCodes.unauthorized,
          message: "Actor identity context is required for authorization.",
          reasonCode: "authorization-evaluation-invalid-actor",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        });
      }

      const requiredPermissionKey = this.resolveRequiredString(context, requirement.requiredPermissionKey, "requiredPermissionKey");
      if (!requiredPermissionKey) {
        return this.denied({
          code: AuthorizationTransportFailureCodes.invalidRequest,
          message: "Authorization requirement requiredPermissionKey is missing.",
          reasonCode: "authorization-evaluation-invalid-permission-key",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        });
      }

      const request = this.buildEvaluationRequest(context, requirement, {
        actor: Object.freeze({
          actorUserIdentityId,
          actorServiceId,
          activeWorkspaceId: normalizeOptional(actor?.activeWorkspaceId),
          authenticatedAt: normalizeOptional(actor?.authenticatedAt),
        }),
        requiredPermissionKey,
      });
      if (!request.ok) {
        return this.denied(request.failure);
      }

      const result = await this.dependencies.decisionEvaluator.evaluateDecision(request.request);
      if (result.decision.isAllowed) {
        return Object.freeze({
          ok: true,
          decision: result.decision,
          debug: result.debug,
        });
      }

      return this.denied(this.mapDeniedDecision(result));
    } catch (error) {
      return this.denied({
        code: AuthorizationTransportFailureCodes.internal,
        message: normalizeErrorMessage(error),
      });
    }
  }

  private buildEvaluationRequest(
    context: TContext,
    requirement: AuthorizationTransportRequirement<TContext>,
    resolved: {
      readonly actor: AuthorizationActorReference;
      readonly requiredPermissionKey: string;
    },
  ):
    | { readonly ok: true; readonly request: AuthorizationPolicyDecisionEvaluationRequest }
    | { readonly ok: false; readonly failure: AuthorizationTransportFailure } {
    const asOf = this.resolveOptionalString(context, requirement.asOf);
    if (requirement.target.kind === AuthorizationPolicyEvaluationTargetKinds.resourceInstance) {
      const resourceType = this.resolveRequiredString(context, requirement.target.resourceType, "target.resourceType");
      const resourceId = this.resolveRequiredString(context, requirement.target.resourceId, "target.resourceId");
      if (!resourceType || !resourceId) {
        return {
          ok: false,
          failure: Object.freeze({
            code: AuthorizationTransportFailureCodes.invalidRequest,
            message: "Authorization resource-instance target requires resourceType and resourceId.",
            reasonCode: "authorization-evaluation-invalid-context",
            denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
          }),
        };
      }

      return {
        ok: true,
        request: Object.freeze({
          actor: resolved.actor,
          requiredPermissionKey: resolved.requiredPermissionKey,
          asOf,
          includeDebugDetails: requirement.includeDebugDetails === true,
          target: Object.freeze({
            kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
            resource: Object.freeze({
              resourceFamily: this.resolveValue(context, requirement.target.resourceFamily),
              resourceType,
              resourceId,
            }),
          }),
        }),
      };
    }

    const workspaceId = this.resolveRequiredString(context, requirement.target.workspaceId, "target.workspaceId");
    const capabilityResourceType = this.resolveRequiredString(
      context,
      requirement.target.capabilityResourceType,
      "target.capabilityResourceType",
    );
    if (!workspaceId || !capabilityResourceType) {
      return {
        ok: false,
        failure: Object.freeze({
          code: AuthorizationTransportFailureCodes.invalidRequest,
          message: "Authorization workspace-capability target requires workspaceId and capabilityResourceType.",
          reasonCode: "authorization-evaluation-invalid-context",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        }),
      };
    }

    return {
      ok: true,
      request: Object.freeze({
        actor: resolved.actor,
        requiredPermissionKey: resolved.requiredPermissionKey,
        asOf,
        includeDebugDetails: requirement.includeDebugDetails === true,
        target: Object.freeze({
          kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
          workspaceId,
          capabilityResourceType,
        }),
      }),
    };
  }

  private mapDeniedDecision(result: AuthorizationPolicyDecisionEvaluationResult): AuthorizationTransportFailure {
    if (
      result.decision.denialReason === AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext
      && result.decision.reasonCode.includes("invalid-actor")
    ) {
      return Object.freeze({
        code: AuthorizationTransportFailureCodes.unauthorized,
        message: result.decision.reason,
        reasonCode: result.decision.reasonCode,
        denialReason: result.decision.denialReason,
      });
    }
    if (result.decision.denialReason === AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext) {
      return Object.freeze({
        code: AuthorizationTransportFailureCodes.invalidRequest,
        message: result.decision.reason,
        reasonCode: result.decision.reasonCode,
        denialReason: result.decision.denialReason,
      });
    }
    return Object.freeze({
      code: AuthorizationTransportFailureCodes.forbidden,
      message: result.decision.reason,
      reasonCode: result.decision.reasonCode,
      denialReason: result.decision.denialReason,
    });
  }

  private resolveValue<TValue>(context: TContext, resolver: ContextValueResolver<TContext, TValue>): TValue {
    if (typeof resolver === "function") {
      return (resolver as (value: TContext) => TValue)(context);
    }
    return resolver;
  }

  private resolveOptionalString(
    context: TContext,
    resolver: ContextValueResolver<TContext, string | undefined> | undefined,
  ): string | undefined {
    if (!resolver) {
      return undefined;
    }
    const value = this.resolveValue(context, resolver);
    return normalizeOptional(value);
  }

  private resolveRequiredString(
    context: TContext,
    resolver: ContextValueResolver<TContext, string>,
    _label: string,
  ): string | undefined {
    const value = this.resolveValue(context, resolver);
    return normalizeOptional(value);
  }

  private denied(failure: AuthorizationTransportFailure): AuthorizationTransportGuardDenied {
    return Object.freeze({
      ok: false,
      failure: Object.freeze({
        code: failure.code,
        message: failure.message,
        reasonCode: failure.reasonCode,
        denialReason: failure.denialReason,
      }),
    });
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const normalized = error.message.trim();
    return normalized || "Authorization evaluation failed unexpectedly.";
  }
  return "Authorization evaluation failed unexpectedly.";
}
