import {
  PolicyDecisionOutcomes,
  ResourceOwnershipScopes,
  ResourceVisibilities,
  SharingPolicyModes,
  createActorContext,
  createPermissionKey,
  createResourcePolicyContext,
  createSharingGrant,
} from "@domain/authorization/AuthorizationDomain";
import type {
  AuthorizationPolicyDecision,
  AuthorizationPolicyDecisionDebugDetails,
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
  AuthorizationPolicyDecisionDenialReason,
  AuthorizationSharingGrantRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationPolicyDecisionDenialReasons,
  AuthorizationPolicyEvaluationTargetKinds,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationDecisionReasonCodes } from "@shared/contracts/authorization/AuthorizationDiagnosticCatalogs";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";
import {
  EffectivePermissionResolutionService,
  EffectivePermissionResolutionSourceKinds,
  type IEffectivePermissionResolutionService,
} from "./EffectivePermissionResolutionService";

export interface AuthorizationPolicyDecisionEvaluatorClock {
  now(): Date;
}

export interface AuthorizationPolicyDecisionEvaluatorDependencies {
  readonly roleGrantReadRepository: IAuthorizationRoleGrantReadRepository;
  readonly sharingGrantReadRepository: IAuthorizationSharingGrantReadRepository;
  readonly resourcePolicyMetadataReadRepository: IAuthorizationResourcePolicyMetadataReadRepository;
  readonly effectivePermissionResolver?: IEffectivePermissionResolutionService;
  readonly clock?: AuthorizationPolicyDecisionEvaluatorClock;
  readonly diagnosticsLogger?: {
    info(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void;
  };
}

const WorkspaceCapabilitySyntheticOwnerUserIdentityId = "__workspace-capability-owner__";

export class AuthorizationPolicyDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  private readonly effectivePermissionResolver: IEffectivePermissionResolutionService;
  private readonly clock: AuthorizationPolicyDecisionEvaluatorClock;
  private readonly diagnosticsLogger: {
    info(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void;
  };

  public constructor(private readonly dependencies: AuthorizationPolicyDecisionEvaluatorDependencies) {
    this.effectivePermissionResolver = dependencies.effectivePermissionResolver ?? new EffectivePermissionResolutionService();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
    this.diagnosticsLogger = dependencies.diagnosticsLogger ?? {
      info: () => {},
    };
  }

  public async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    const evaluatedAt = normalizeOptional(request.asOf) ?? this.clock.now().toISOString();
    const actorUserIdentityId = normalizeOptional(request.actor.actorUserIdentityId);
    const actorServiceId = normalizeOptional(request.actor.actorServiceId);

    if (!actorUserIdentityId && !actorServiceId) {
      return this.toResult({
        request,
        decision: createDeniedDecision({
          evaluatedAt,
          requiredPermissionKey: normalizePermissionKey(request.requiredPermissionKey) ?? "authorization.invalid",
          reasonCode: AuthorizationDecisionReasonCodes.invalidActorContext,
          reason: "Actor identity context is required for authorization evaluation.",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        }),
        debug: request.includeDebugDetails
          ? createDebugDetails(request.target.kind, EffectivePermissionResolutionSourceKinds.none, 0, 0, 0)
          : undefined,
      });
    }

    const requiredPermissionKey = normalizePermissionKey(request.requiredPermissionKey);
    if (!requiredPermissionKey) {
      return this.toResult({
        request,
        decision: createDeniedDecision({
          evaluatedAt,
          requiredPermissionKey: "authorization.invalid",
          reasonCode: AuthorizationDecisionReasonCodes.invalidPermissionKey,
          reason: "The required permission key is invalid.",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        }),
        debug: request.includeDebugDetails
          ? createDebugDetails(request.target.kind, EffectivePermissionResolutionSourceKinds.none, 0, 0, 0)
          : undefined,
      });
    }

    try {
      this.diagnosticsLogger.info({
        event: "auth.decision.role-snapshot.query",
        details: Object.freeze({
          targetKind: request.target.kind,
          requiredPermissionKey,
          actorUserIdentityId,
          actorServiceId,
          activeWorkspaceId: normalizeOptional(request.actor.activeWorkspaceId),
          asOf: request.asOf,
        }),
      });
      const roleGrantSnapshot = await this.dependencies.roleGrantReadRepository.getActorRoleGrantSnapshot({
        actor: request.actor,
        resource: request.target.kind === AuthorizationPolicyEvaluationTargetKinds.resourceInstance
          ? request.target.resource
          : undefined,
        asOf: request.asOf,
      });
      this.diagnosticsLogger.info({
        event: "auth.decision.role-snapshot.result",
        details: Object.freeze({
          roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
          permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
          sampleRoleAssignmentScopes: Object.freeze(
            [...new Set(roleGrantSnapshot.roleAssignments.map((assignment) => assignment.scope))].slice(0, 4),
          ),
          sampleRoleKeys: Object.freeze(
            [...new Set(roleGrantSnapshot.roleAssignments.map((assignment) => assignment.roleKey))].slice(0, 8),
          ),
        }),
      });

      const actorContext = createActorContext({
        actorUserIdentityId,
        actorServiceId,
        activeWorkspaceId: normalizeOptional(request.actor.activeWorkspaceId),
        authenticatedAt: normalizeOptional(request.actor.authenticatedAt),
        roleAssignments: roleGrantSnapshot.roleAssignments,
        permissionGrants: roleGrantSnapshot.permissionGrants,
      });

      if (request.target.kind === AuthorizationPolicyEvaluationTargetKinds.resourceInstance) {
        const resourcePolicyMetadata = await this.dependencies.resourcePolicyMetadataReadRepository.findResourcePolicyMetadata({
          resource: request.target.resource,
          asOf: request.asOf,
        });

        if (!resourcePolicyMetadata) {
          return this.toResult({
            request,
            decision: createDeniedDecision({
              evaluatedAt,
              requiredPermissionKey,
              reasonCode: AuthorizationPolicyDecisionDenialReasons.resourcePolicyMetadataNotFound,
              reason: "The resource policy metadata could not be resolved.",
              denialReason: AuthorizationPolicyDecisionDenialReasons.resourcePolicyMetadataNotFound,
            }),
            debug: request.includeDebugDetails
              ? createDebugDetails(
                request.target.kind,
                EffectivePermissionResolutionSourceKinds.none,
                roleGrantSnapshot.roleAssignments.length,
                roleGrantSnapshot.permissionGrants.length,
                0,
              )
              : undefined,
          });
        }

        const sharingGrantRecords = await this.dependencies.sharingGrantReadRepository.listSharingGrants({
          resource: request.target.resource,
          asOf: request.asOf,
        });

        const resourceContext = createResourcePolicyContext({
          resourceType: resourcePolicyMetadata.resourceType,
          resourceId: resourcePolicyMetadata.resourceId,
          ownerUserIdentityId: resourcePolicyMetadata.ownerUserIdentityId,
          ownershipScope: resourcePolicyMetadata.ownershipScope,
          workspaceId: resourcePolicyMetadata.workspaceId,
          visibility: resourcePolicyMetadata.visibility,
          sharingPolicy: {
            mode: resourcePolicyMetadata.sharingPolicyMode,
            allowResharing: resourcePolicyMetadata.allowResharing,
          },
          sharingGrants: sharingGrantRecords.map((record) => this.toSharingGrant(record)),
          isPublishedCapable: resourcePolicyMetadata.isPublishedCapable,
          publishedAt: resourcePolicyMetadata.publishedAt,
        });

        const resolution = this.effectivePermissionResolver.resolvePermission({
          actor: actorContext,
          resource: resourceContext,
          requiredPermissionKey,
          asOf: request.asOf,
        });

        const result = this.toResult({
          request,
          decision: toAuthorizationPolicyDecision(resolution.decision),
          debug: request.includeDebugDetails
            ? createDebugDetails(
              request.target.kind,
              resolution.sourceKind,
              roleGrantSnapshot.roleAssignments.length,
              roleGrantSnapshot.permissionGrants.length,
              sharingGrantRecords.length,
            )
            : undefined,
        });
        this.diagnosticsLogger.info({
          event: "auth.decision.completed",
          details: Object.freeze({
            outcome: result.decision.isAllowed ? "allow" : "deny",
            reasonCode: result.decision.reasonCode,
            sourceKind: resolution.sourceKind,
            targetKind: request.target.kind,
            requiredPermissionKey,
          }),
        });
        return result;
      }

      const workspaceId = request.target.workspaceId.trim();
      const capabilityResourceType = request.target.capabilityResourceType.trim();
      const workspaceCapabilityResource = createResourcePolicyContext({
        resourceType: capabilityResourceType,
        resourceId: `workspace-capability:${workspaceId}:${capabilityResourceType}`,
        ownerUserIdentityId: WorkspaceCapabilitySyntheticOwnerUserIdentityId,
        ownershipScope: ResourceOwnershipScopes.workspace,
        workspaceId,
        visibility: ResourceVisibilities.private,
        sharingPolicy: {
          mode: SharingPolicyModes.ownerOnly,
          allowResharing: false,
        },
        sharingGrants: [],
        isPublishedCapable: false,
      });

      const resolution = this.effectivePermissionResolver.resolvePermission({
        actor: actorContext,
        resource: workspaceCapabilityResource,
        requiredPermissionKey,
        asOf: request.asOf,
      });
      this.diagnosticsLogger.info({
        event: "auth.decision.workspace-capability.evaluate",
        details: Object.freeze({
          workspaceId,
          capabilityResourceType,
          requiredPermissionKey,
        }),
      });

      const result = this.toResult({
        request,
        decision: toAuthorizationPolicyDecision(resolution.decision),
        debug: request.includeDebugDetails
          ? createDebugDetails(
            request.target.kind,
            resolution.sourceKind,
            roleGrantSnapshot.roleAssignments.length,
            roleGrantSnapshot.permissionGrants.length,
            0,
          )
          : undefined,
      });
      this.diagnosticsLogger.info({
        event: "auth.decision.completed",
        details: Object.freeze({
          outcome: result.decision.isAllowed ? "allow" : "deny",
          reasonCode: result.decision.reasonCode,
          sourceKind: resolution.sourceKind,
          targetKind: request.target.kind,
          requiredPermissionKey,
        }),
      });
      return result;
    } catch {
      return this.toResult({
        request,
        decision: createDeniedDecision({
          evaluatedAt,
          requiredPermissionKey,
          reasonCode: AuthorizationDecisionReasonCodes.invalidEvaluationContext,
          reason: "Authorization evaluation context could not be resolved.",
          denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
        }),
        debug: request.includeDebugDetails
          ? createDebugDetails(
            request.target.kind,
            EffectivePermissionResolutionSourceKinds.none,
            0,
            0,
            0,
          )
          : undefined,
      });
    }
  }

  private toSharingGrant(record: AuthorizationSharingGrantRecord) {
    return createSharingGrant({
      id: record.id,
      subject: record.subject,
      permissions: record.permissionKeys,
      grantedByUserIdentityId: record.grantedByUserIdentityId,
      grantedAt: record.grantedAt,
      expiresAt: record.expiresAt,
      revokedAt: record.revokedAt,
    });
  }

  private toResult(input: {
    readonly request: AuthorizationPolicyDecisionEvaluationRequest;
    readonly decision: AuthorizationPolicyDecision;
    readonly debug?: AuthorizationPolicyDecisionDebugDetails;
  }): AuthorizationPolicyDecisionEvaluationResult {
    if (!input.request.includeDebugDetails) {
      return Object.freeze({
        decision: input.decision,
      });
    }

    return Object.freeze({
      decision: input.decision,
      debug: input.debug,
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePermissionKey(value: string): string | undefined {
  try {
    return createPermissionKey(value);
  } catch {
    return undefined;
  }
}

function toAuthorizationPolicyDecision(
  decision: {
    readonly outcome: string;
    readonly requiredPermissionKey: string;
    readonly reasonCode: string;
    readonly reason: string;
    readonly evaluatedAt: string;
    readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
    readonly matchedPermissionGrantIds: ReadonlyArray<string>;
    readonly matchedSharingGrantIds: ReadonlyArray<string>;
  },
): AuthorizationPolicyDecision {
  const outcome = decision.outcome === PolicyDecisionOutcomes.allow
    ? PolicyDecisionOutcomes.allow
    : PolicyDecisionOutcomes.deny;
  return Object.freeze({
    isAllowed: outcome === PolicyDecisionOutcomes.allow,
    outcome,
    requiredPermissionKey: decision.requiredPermissionKey,
    reasonCode: decision.reasonCode,
    reason: decision.reason,
    denialReason: outcome === PolicyDecisionOutcomes.deny
      ? toDenialReason(decision.reasonCode)
      : undefined,
    evaluatedAt: decision.evaluatedAt,
    matchedRoleAssignmentIds: decision.matchedRoleAssignmentIds,
    matchedPermissionGrantIds: decision.matchedPermissionGrantIds,
    matchedSharingGrantIds: decision.matchedSharingGrantIds,
  });
}

function createDeniedDecision(input: {
  readonly evaluatedAt: string;
  readonly requiredPermissionKey: string;
  readonly reasonCode: string;
  readonly reason: string;
  readonly denialReason: AuthorizationPolicyDecisionDenialReason;
}): AuthorizationPolicyDecision {
  return Object.freeze({
    isAllowed: false,
    outcome: PolicyDecisionOutcomes.deny,
    requiredPermissionKey: input.requiredPermissionKey,
    reasonCode: input.reasonCode,
    reason: input.reason,
    denialReason: input.denialReason,
    evaluatedAt: input.evaluatedAt,
    matchedRoleAssignmentIds: Object.freeze([]),
    matchedPermissionGrantIds: Object.freeze([]),
    matchedSharingGrantIds: Object.freeze([]),
  });
}

function createDebugDetails(
  targetKind: AuthorizationPolicyDecisionDebugDetails["targetKind"],
  sourceKind: string,
  roleAssignmentCount: number,
  permissionGrantCount: number,
  sharingGrantCount: number,
): AuthorizationPolicyDecisionDebugDetails {
  return Object.freeze({
    targetKind,
    sourceKind,
    roleAssignmentCount,
    permissionGrantCount,
    sharingGrantCount,
  });
}

function toDenialReason(reasonCode: string): AuthorizationPolicyDecisionDenialReason {
  if (reasonCode === AuthorizationPolicyDecisionDenialReasons.resourcePolicyMetadataNotFound) {
    return AuthorizationPolicyDecisionDenialReasons.resourcePolicyMetadataNotFound;
  }
  if (reasonCode === AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant) {
    return AuthorizationPolicyDecisionDenialReasons.explicitDenyPermissionGrant;
  }
  if (reasonCode === AuthorizationDecisionReasonCodes.noEffectivePermission) {
    return AuthorizationPolicyDecisionDenialReasons.insufficientPermissions;
  }
  return AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext;
}
