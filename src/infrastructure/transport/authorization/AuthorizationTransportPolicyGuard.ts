import type {
  AuthorizationActorReference,
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
  AuthorizationPolicyDecisionDenialReason,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationPolicyDecisionDenialReasons,
  AuthorizationPolicyEvaluationTargetKinds,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import {
  AuthorizationContextResolutionReasonCodes,
  AuthorizationRuntimeAvailabilityReasonCodes,
  AuthorizationTransportMappingReasonCodes,
} from "@shared/contracts/authorization/AuthorizationDiagnosticCatalogs";
import {
  AuthorizationDiagnosticEmissionSurfaces,
  AuthorizationDiagnosticEvidenceKinds,
  AuthorizationDiagnosticMatchedSourceKinds,
  AuthorizationDiagnosticOutcomes,
  AuthorizationDiagnosticProvenanceStages,
  AuthorizationDiagnosticTargetKinds,
  createAuthorizationDiagnosticRecord,
  isKnownAuthorizationDiagnosticReasonCode,
  projectAuthorizationDiagnosticRecord,
  type AuthorizationDiagnosticOutcome,
  type AuthorizationDiagnosticReasonCode,
  type AuthorizationDiagnosticRecord,
} from "@shared/contracts/authorization/AuthorizationDiagnosticsContracts";

export const AuthorizationTransportFailureCodes = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  invalidRequest: "invalid-request",
  temporarilyUnavailable: "temporarily-unavailable",
  internal: "internal",
});

export type AuthorizationTransportFailureCode =
  typeof AuthorizationTransportFailureCodes[keyof typeof AuthorizationTransportFailureCodes];

export interface AuthorizationTransportFailure {
  readonly code: AuthorizationTransportFailureCode;
  readonly message: string;
  readonly reasonCode?: string;
  readonly denialReason?: AuthorizationPolicyDecisionDenialReason;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly availabilityState?: "degraded" | "unavailable";
  readonly diagnostic?: AuthorizationDiagnosticRecord;
  readonly publicDiagnostic?: AuthorizationDiagnosticRecord;
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
  readonly requestId?: ContextValueResolver<TContext, string | undefined>;
  readonly correlationId?: ContextValueResolver<TContext, string | undefined>;
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
    const requestId = this.resolveOptionalString(context, requirement.requestId);
    const correlationId = this.resolveOptionalString(context, requirement.correlationId);
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
        }, {
          context,
          requirement,
          requestId,
          correlationId,
          actorUserIdentityId,
        });
      }

      const requiredPermissionKey = this.resolveRequiredString(context, requirement.requiredPermissionKey, "requiredPermissionKey");
      if (!requiredPermissionKey) {
        return this.denied({
          code: AuthorizationTransportFailureCodes.invalidRequest,
          message: "Authorization requirement requiredPermissionKey is missing.",
          reasonCode: "authorization-evaluation-invalid-permission-key",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        }, {
          context,
          requirement,
          requestId,
          correlationId,
          actorUserIdentityId: actorUserIdentityId ?? actorServiceId,
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
        return this.denied(request.failure, {
          context,
          requirement,
          requestId,
          correlationId,
          actorUserIdentityId: actorUserIdentityId ?? actorServiceId,
          requiredPermissionKey,
        });
      }

      const result = await this.dependencies.decisionEvaluator.evaluateDecision(request.request);
      if (result.decision.isAllowed) {
        return Object.freeze({
          ok: true,
          decision: result.decision,
          debug: result.debug,
        });
      }

      return this.denied(this.mapDeniedDecision(result), {
        context,
        requirement,
        requestId,
        correlationId,
        actorUserIdentityId: actorUserIdentityId ?? actorServiceId,
        requiredPermissionKey,
      });
    } catch (error) {
      const normalizedErrorMessage = normalizeErrorMessage(error);
      const transientFailure = /temporarily unavailable|timeout|timed out|unreachable|unavailable|retry/i.test(normalizedErrorMessage);
      return this.denied({
        code: transientFailure
          ? AuthorizationTransportFailureCodes.temporarilyUnavailable
          : AuthorizationTransportFailureCodes.internal,
        message: normalizeErrorMessage(error),
        reasonCode: transientFailure
          ? AuthorizationTransportMappingReasonCodes.adapterUnavailable
          : AuthorizationTransportMappingReasonCodes.transportMappingFailed,
        availabilityState: transientFailure ? "unavailable" : undefined,
      }, {
        context,
        requirement,
        requestId,
        correlationId,
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
    if (isRuntimeAvailabilityReasonCode(result.decision.reasonCode)) {
      return Object.freeze({
        code: AuthorizationTransportFailureCodes.temporarilyUnavailable,
        message: result.decision.reason,
        reasonCode: result.decision.reasonCode,
        denialReason: result.decision.denialReason,
        availabilityState: result.decision.reasonCode === AuthorizationRuntimeAvailabilityReasonCodes.runtimeDegraded
          ? "degraded"
          : "unavailable",
      });
    }
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

  private denied(
    failure: Omit<AuthorizationTransportFailure, "diagnostic" | "publicDiagnostic">,
    context: {
      readonly context: TContext;
      readonly requirement: AuthorizationTransportRequirement<TContext>;
      readonly requestId?: string;
      readonly correlationId?: string;
      readonly actorUserIdentityId?: string;
      readonly requiredPermissionKey?: string;
    },
  ): AuthorizationTransportGuardDenied {
    const diagnosticCorrelationId = resolveDiagnosticCorrelationId({
      explicitCorrelationId: context.correlationId,
      requestId: context.requestId,
      actorUserIdentityId: context.actorUserIdentityId,
      requiredPermissionKey: context.requiredPermissionKey
        ?? this.resolveRequiredString(context.context, context.requirement.requiredPermissionKey, "requiredPermissionKey")
        ?? "authorization.invalid",
      target: context.requirement.target,
      context: context.context,
    });
    const transportTarget = resolveTransportDiagnosticTarget({
      target: context.requirement.target,
      context: context.context,
    });
    const reasonCode = resolveTransportFailureReasonCode(failure);
    const outcome = resolveTransportFailureOutcome(failure);
    const runtimeAvailability = failure.code === AuthorizationTransportFailureCodes.temporarilyUnavailable
      ? Object.freeze({
        affectedByRuntimeAvailability: true,
        degraded: failure.availabilityState === "degraded",
        blockingReasonCodes: failure.reasonCode ? Object.freeze([failure.reasonCode]) : undefined,
        detail: failure.message,
      })
      : undefined;

    const diagnostic = createAuthorizationDiagnosticRecord({
      outcome,
      correlation: Object.freeze({
        requestId: context.requestId,
        correlationId: diagnosticCorrelationId,
      }),
      actor: Object.freeze({
        actorIdentityId: context.actorUserIdentityId,
      }),
      target: transportTarget,
      requiredPermissionKey: context.requiredPermissionKey
        ?? this.resolveRequiredString(context.context, context.requirement.requiredPermissionKey, "requiredPermissionKey")
        ?? "authorization.invalid",
      matchedSourceKind: outcome === AuthorizationDiagnosticOutcomes.deny
        ? AuthorizationDiagnosticMatchedSourceKinds.none
        : undefined,
      reasonCode,
      denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.transportMapping,
      runtimeAvailability,
      evidence: Object.freeze({
        missing: Object.freeze([
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
        ]),
      }),
      extensions: Object.freeze({
        "authorization.transport.failure-code.public": failure.code,
        "authorization.transport.availability-state.public": failure.availabilityState,
      }),
    });
    const publicDiagnostic = projectAuthorizationDiagnosticRecord(diagnostic, {
      surface: AuthorizationDiagnosticEmissionSurfaces.external,
      includeIdentifiers: false,
      secretSensitiveSurface: true,
      adminSensitiveSurface: true,
    });

    return Object.freeze({
      ok: false,
      failure: Object.freeze({
        code: failure.code,
        message: failure.message,
        reasonCode: failure.reasonCode,
        denialReason: failure.denialReason,
        requestId: context.requestId,
        correlationId: diagnosticCorrelationId,
        availabilityState: failure.availabilityState,
        diagnostic,
        publicDiagnostic,
      }),
    });
  }
}

function resolveDiagnosticCorrelationId<TContext>(input: {
  readonly explicitCorrelationId?: string;
  readonly requestId?: string;
  readonly actorUserIdentityId?: string;
  readonly requiredPermissionKey: string;
  readonly target: AuthorizationTransportRequirementTarget<TContext>;
  readonly context: TContext;
}): string {
  const explicit = normalizeOptional(input.explicitCorrelationId);
  if (explicit) {
    return explicit;
  }
  const requestId = normalizeOptional(input.requestId);
  if (requestId) {
    return requestId;
  }

  const actor = normalizeOptional(input.actorUserIdentityId) ?? "anonymous";
  if (input.target.kind === AuthorizationPolicyEvaluationTargetKinds.resourceInstance) {
    const resourceType = normalizeOptional(resolveContextValue(input.context, input.target.resourceType)) ?? "resource";
    const resourceId = normalizeOptional(resolveContextValue(input.context, input.target.resourceId)) ?? "resource-id";
    return `${actor}:${input.requiredPermissionKey}:resource:${resourceType}:${resourceId}`;
  }

  const workspaceId = normalizeOptional(resolveContextValue(input.context, input.target.workspaceId)) ?? "workspace";
  const capabilityResourceType = normalizeOptional(resolveContextValue(input.context, input.target.capabilityResourceType)) ?? "capability";
  return `${actor}:${input.requiredPermissionKey}:workspace:${workspaceId}:${capabilityResourceType}`;
}

function resolveTransportDiagnosticTarget<TContext>(input: {
  readonly target: AuthorizationTransportRequirementTarget<TContext>;
  readonly context: TContext;
}): {
  readonly kind: "resource-instance" | "workspace-capability" | "unresolved";
  readonly targetIdentifier?: string;
  readonly targetWorkspaceId?: string;
  readonly targetResourceFamily?: AuthorizationResourceFamily;
  readonly targetResourceType?: string;
} {
  if (input.target.kind === AuthorizationPolicyEvaluationTargetKinds.resourceInstance) {
    const resourceId = normalizeOptional(resolveContextValue(input.context, input.target.resourceId));
    const resourceType = normalizeOptional(resolveContextValue(input.context, input.target.resourceType));
    if (!resourceId) {
      return Object.freeze({
        kind: AuthorizationDiagnosticTargetKinds.unresolved,
      });
    }
    return Object.freeze({
      kind: AuthorizationDiagnosticTargetKinds.resourceInstance,
      targetIdentifier: resourceId,
      targetResourceFamily: resolveContextValue(input.context, input.target.resourceFamily),
      targetResourceType: resourceType,
    });
  }

  const workspaceId = normalizeOptional(resolveContextValue(input.context, input.target.workspaceId));
  const capabilityResourceType = normalizeOptional(resolveContextValue(input.context, input.target.capabilityResourceType));
  if (!workspaceId) {
    return Object.freeze({
      kind: AuthorizationDiagnosticTargetKinds.unresolved,
    });
  }
  return Object.freeze({
    kind: AuthorizationDiagnosticTargetKinds.workspaceCapability,
    targetIdentifier: capabilityResourceType ? `workspace-capability:${workspaceId}:${capabilityResourceType}` : undefined,
    targetWorkspaceId: workspaceId,
    targetResourceType: capabilityResourceType,
  });
}

function resolveTransportFailureOutcome(
  failure: Pick<AuthorizationTransportFailure, "code" | "availabilityState">,
): AuthorizationDiagnosticOutcome {
  if (failure.code === AuthorizationTransportFailureCodes.temporarilyUnavailable) {
    return failure.availabilityState === "degraded"
      ? AuthorizationDiagnosticOutcomes.degraded
      : AuthorizationDiagnosticOutcomes.unavailable;
  }
  return AuthorizationDiagnosticOutcomes.deny;
}

function resolveTransportFailureReasonCode(
  failure: Pick<AuthorizationTransportFailure, "reasonCode" | "code">,
): AuthorizationDiagnosticReasonCode {
  if (failure.reasonCode && isKnownAuthorizationDiagnosticReasonCode(failure.reasonCode)) {
    return failure.reasonCode;
  }

  if (failure.code === AuthorizationTransportFailureCodes.unauthorized) {
    return AuthorizationContextResolutionReasonCodes.actorContextMissing;
  }
  if (failure.code === AuthorizationTransportFailureCodes.invalidRequest) {
    return AuthorizationTransportMappingReasonCodes.permissionEntryMissing;
  }
  if (failure.code === AuthorizationTransportFailureCodes.forbidden) {
    return AuthorizationTransportMappingReasonCodes.transportDenied;
  }
  if (failure.code === AuthorizationTransportFailureCodes.temporarilyUnavailable) {
    return AuthorizationRuntimeAvailabilityReasonCodes.runtimeGateBlocked;
  }
  return AuthorizationTransportMappingReasonCodes.transportMappingFailed;
}

function isRuntimeAvailabilityReasonCode(value: string): value is AuthorizationDiagnosticReasonCode {
  return Object.values(AuthorizationRuntimeAvailabilityReasonCodes).includes(
    value as typeof AuthorizationRuntimeAvailabilityReasonCodes[keyof typeof AuthorizationRuntimeAvailabilityReasonCodes],
  );
}

function resolveContextValue<TContext, TValue>(
  context: TContext,
  resolver: ContextValueResolver<TContext, TValue>,
): TValue {
  if (typeof resolver === "function") {
    return (resolver as (value: TContext) => TValue)(context);
  }
  return resolver;
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

