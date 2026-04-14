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
import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
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
import {
  AuthorizationDecisionReasonCodes,
  AuthorizationDiagnosticProvenanceStages,
} from "@shared/contracts/authorization/AuthorizationDiagnosticCatalogs";
import {
  AuthorizationDiagnosticEvidenceKinds,
  AuthorizationDiagnosticMatchedSourceKinds,
  AuthorizationDiagnosticOutcomes,
} from "@shared/contracts/authorization/AuthorizationDiagnosticsContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import type { IAuthorizationResourcePolicyMetadataReadRepository } from "../ports/IAuthorizationResourcePolicyMetadataReadRepository";
import type { IAuthorizationRoleGrantReadRepository } from "../ports/IAuthorizationRoleGrantReadRepository";
import type { IAuthorizationSharingGrantReadRepository } from "../ports/IAuthorizationSharingGrantReadRepository";
import {
  EffectivePermissionResolutionService,
  EffectivePermissionResolutionSourceKinds,
  type IEffectivePermissionResolutionService,
} from "./EffectivePermissionResolutionService";
import {
  buildAuthorizationDiagnosticCorrelationId,
  buildAuthorizationPolicyDiagnosticContext,
  collectWorkspaceIdsFromAuthorizationInputs,
  emitAuthorizationDiagnosticRecord,
  toAuthorizationDiagnosticMatchedSourceKind,
} from "./AuthorizationDecisionDiagnostics";

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
    this.diagnosticsLogger = dependencies.diagnosticsLogger ?? {
      info: () => {},
    };
    this.effectivePermissionResolver = dependencies.effectivePermissionResolver ?? new EffectivePermissionResolutionService({
      diagnosticsLogger: this.diagnosticsLogger,
    });
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    const evaluatedAt = normalizeOptional(request.asOf) ?? this.clock.now().toISOString();
    const actorUserIdentityId = normalizeOptional(request.actor.actorUserIdentityId);
    const actorServiceId = normalizeOptional(request.actor.actorServiceId);
    const diagnosticCorrelationId = buildAuthorizationDiagnosticCorrelationId({
      request,
      evaluatedAt,
    });

    if (!actorUserIdentityId && !actorServiceId) {
      const decision = createDeniedDecision({
        evaluatedAt,
        requiredPermissionKey: normalizePermissionKey(request.requiredPermissionKey) ?? "authorization.invalid",
        reasonCode: AuthorizationDecisionReasonCodes.invalidActorContext,
        reason: "Actor identity context is required for authorization evaluation.",
        denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
      });
      const result = this.toResult({
        request,
        decision,
        debug: request.includeDebugDetails
          ? createDebugDetails(request.target.kind, EffectivePermissionResolutionSourceKinds.none, 0, 0, 0)
          : undefined,
      });
      this.emitDecisionDiagnostics({
        request,
        actorUserIdentityId,
        diagnosticCorrelationId,
        requiredPermissionKey: decision.requiredPermissionKey,
        result,
        sourceKind: EffectivePermissionResolutionSourceKinds.none,
        roleAssignmentCount: 0,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
        targetSummary: this.resolveTargetSummary(request),
        matchedWorkspaceIds: Object.freeze([]),
        synthesizedFallbackUsed: request.target.kind === AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
      });
      this.logInfo({
        event: "auth.decision.completed",
        details: Object.freeze({
          diagnosticCorrelationId,
          outcome: result.decision.isAllowed ? "allow" : "deny",
          reasonCode: result.decision.reasonCode,
          sourceKind: EffectivePermissionResolutionSourceKinds.none,
          targetKind: request.target.kind,
          requiredPermissionKey: decision.requiredPermissionKey,
        }),
      });
      return result;
    }

    const requiredPermissionKey = normalizePermissionKey(request.requiredPermissionKey);
    if (!requiredPermissionKey) {
      const decision = createDeniedDecision({
        evaluatedAt,
        requiredPermissionKey: "authorization.invalid",
        reasonCode: AuthorizationDecisionReasonCodes.invalidPermissionKey,
        reason: "The required permission key is invalid.",
        denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
      });
      const result = this.toResult({
        request,
        decision,
        debug: request.includeDebugDetails
          ? createDebugDetails(request.target.kind, EffectivePermissionResolutionSourceKinds.none, 0, 0, 0)
          : undefined,
      });
      this.emitDecisionDiagnostics({
        request,
        actorUserIdentityId,
        diagnosticCorrelationId,
        requiredPermissionKey: decision.requiredPermissionKey,
        result,
        sourceKind: EffectivePermissionResolutionSourceKinds.none,
        roleAssignmentCount: 0,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
        targetSummary: this.resolveTargetSummary(request),
        matchedWorkspaceIds: Object.freeze([]),
        synthesizedFallbackUsed: request.target.kind === AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
      });
      this.logInfo({
        event: "auth.decision.completed",
        details: Object.freeze({
          diagnosticCorrelationId,
          outcome: result.decision.isAllowed ? "allow" : "deny",
          reasonCode: result.decision.reasonCode,
          sourceKind: EffectivePermissionResolutionSourceKinds.none,
          targetKind: request.target.kind,
          requiredPermissionKey: decision.requiredPermissionKey,
        }),
      });
      return result;
    }

    try {
      this.logInfo({
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
      this.logInfo({
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

        const matchedWorkspaceIds = collectWorkspaceIdsFromAuthorizationInputs({
          roleAssignments: roleGrantSnapshot.roleAssignments,
          permissionGrants: roleGrantSnapshot.permissionGrants,
          resourceWorkspaceId: resourcePolicyMetadata?.workspaceId,
        });

        if (!resourcePolicyMetadata) {
          this.emitPermissionSnapshotDiagnostic({
            request,
            actorUserIdentityId,
            diagnosticCorrelationId,
            requiredPermissionKey,
            roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
            permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
            sharingGrantCount: 0,
            sharingPolicyMetadataCount: 0,
            targetWorkspaceId: undefined,
            targetIdentifier: request.target.resource.resourceId,
            targetResourceType: request.target.resource.resourceType,
            targetResourceFamily: request.target.resource.resourceFamily,
            matchedWorkspaceIds,
            synthesizedFallbackUsed: false,
            resourcePolicyMetadataMissing: true,
          });
          const result = this.toResult({
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
          this.emitDecisionDiagnostics({
            request,
            actorUserIdentityId,
            diagnosticCorrelationId,
            requiredPermissionKey,
            result,
            sourceKind: EffectivePermissionResolutionSourceKinds.none,
            roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
            permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
            sharingGrantCount: 0,
            targetSummary: this.resolveTargetSummary(request),
            matchedWorkspaceIds,
            synthesizedFallbackUsed: false,
          });
          this.logInfo({
            event: "auth.decision.completed",
            details: Object.freeze({
              diagnosticCorrelationId,
              outcome: result.decision.isAllowed ? "allow" : "deny",
              reasonCode: result.decision.reasonCode,
              sourceKind: EffectivePermissionResolutionSourceKinds.none,
              targetKind: request.target.kind,
              requiredPermissionKey,
            }),
          });
          return result;
        }

        const sharingGrantRecords = await this.dependencies.sharingGrantReadRepository.listSharingGrants({
          resource: request.target.resource,
          asOf: request.asOf,
        });
        this.emitPermissionSnapshotDiagnostic({
          request,
          actorUserIdentityId,
          diagnosticCorrelationId,
          requiredPermissionKey,
          roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
          permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
          sharingGrantCount: sharingGrantRecords.length,
          sharingPolicyMetadataCount: 1,
          targetWorkspaceId: resourcePolicyMetadata.workspaceId,
          targetIdentifier: resourcePolicyMetadata.resourceId,
          targetResourceType: resourcePolicyMetadata.resourceType,
          targetResourceFamily: request.target.resource.resourceFamily,
          matchedWorkspaceIds,
          synthesizedFallbackUsed: false,
          resourcePolicyMetadataMissing: false,
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
          diagnosticContext: buildAuthorizationPolicyDiagnosticContext({
            request,
            correlationId: diagnosticCorrelationId,
            targetWorkspaceId: resourcePolicyMetadata.workspaceId,
            targetResourceType: resourcePolicyMetadata.resourceType,
            targetIdentifier: resourcePolicyMetadata.resourceId,
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
              sharingGrantRecords.length,
            )
            : undefined,
        });
        this.emitDecisionDiagnostics({
          request,
          actorUserIdentityId,
          diagnosticCorrelationId,
          requiredPermissionKey,
          result,
          sourceKind: resolution.sourceKind,
          roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
          permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
          sharingGrantCount: sharingGrantRecords.length,
          applicableScopeCount: resolution.scopeFiltering?.applicableScopeCount,
          targetSummary: Object.freeze({
            targetWorkspaceId: resourcePolicyMetadata.workspaceId,
            targetIdentifier: resourcePolicyMetadata.resourceId,
            targetResourceType: resourcePolicyMetadata.resourceType,
            targetResourceFamily: request.target.resource.resourceFamily,
          }),
          matchedWorkspaceIds: resolution.scopeFiltering?.matchedWorkspaceIds ?? matchedWorkspaceIds,
          synthesizedFallbackUsed: false,
          visibilityFallbackUsed: resolution.scopeFiltering?.visibilityFallbackUsed ?? false,
        });
        this.logInfo({
          event: "auth.decision.completed",
          details: Object.freeze({
            diagnosticCorrelationId,
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
      const capabilityTargetIdentifier = workspaceCapabilityResource.resourceId;
      const matchedWorkspaceIds = collectWorkspaceIdsFromAuthorizationInputs({
        roleAssignments: roleGrantSnapshot.roleAssignments,
        permissionGrants: roleGrantSnapshot.permissionGrants,
        resourceWorkspaceId: workspaceId,
      });
      this.emitPermissionSnapshotDiagnostic({
        request,
        actorUserIdentityId,
        diagnosticCorrelationId,
        requiredPermissionKey,
        roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
        permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
        sharingGrantCount: 0,
        sharingPolicyMetadataCount: 1,
        targetWorkspaceId: workspaceId,
        targetIdentifier: capabilityTargetIdentifier,
        targetResourceType: capabilityResourceType,
        targetResourceFamily: undefined,
        matchedWorkspaceIds,
        synthesizedFallbackUsed: true,
        resourcePolicyMetadataMissing: false,
      });

      const resolution = this.effectivePermissionResolver.resolvePermission({
        actor: actorContext,
        resource: workspaceCapabilityResource,
        requiredPermissionKey,
        asOf: request.asOf,
        diagnosticContext: buildAuthorizationPolicyDiagnosticContext({
          request,
          correlationId: diagnosticCorrelationId,
          targetWorkspaceId: workspaceId,
          targetResourceType: capabilityResourceType,
          targetIdentifier: capabilityTargetIdentifier,
        }),
      });
      this.logInfo({
        event: "auth.decision.workspace-capability.evaluate",
        details: Object.freeze({
          diagnosticCorrelationId,
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
      this.emitDecisionDiagnostics({
        request,
        actorUserIdentityId,
        diagnosticCorrelationId,
        requiredPermissionKey,
        result,
        sourceKind: resolution.sourceKind,
        roleAssignmentCount: roleGrantSnapshot.roleAssignments.length,
        permissionGrantCount: roleGrantSnapshot.permissionGrants.length,
        sharingGrantCount: 0,
        applicableScopeCount: resolution.scopeFiltering?.applicableScopeCount,
        targetSummary: Object.freeze({
          targetWorkspaceId: workspaceId,
          targetIdentifier: capabilityTargetIdentifier,
          targetResourceType: capabilityResourceType,
          targetResourceFamily: undefined,
        }),
        matchedWorkspaceIds: resolution.scopeFiltering?.matchedWorkspaceIds ?? matchedWorkspaceIds,
        synthesizedFallbackUsed: true,
        visibilityFallbackUsed: resolution.scopeFiltering?.visibilityFallbackUsed ?? false,
      });
      this.logInfo({
        event: "auth.decision.completed",
        details: Object.freeze({
          diagnosticCorrelationId,
          outcome: result.decision.isAllowed ? "allow" : "deny",
          reasonCode: result.decision.reasonCode,
          sourceKind: resolution.sourceKind,
          targetKind: request.target.kind,
          requiredPermissionKey,
        }),
      });
      return result;
    } catch {
      const decision = createDeniedDecision({
        evaluatedAt,
        requiredPermissionKey,
        reasonCode: AuthorizationDecisionReasonCodes.invalidEvaluationContext,
        reason: "Authorization evaluation context could not be resolved.",
        denialReason: AuthorizationPolicyDecisionDenialReasons.invalidEvaluationContext,
      });
      const result = this.toResult({
        request,
        decision,
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
      this.emitDecisionDiagnostics({
        request,
        actorUserIdentityId,
        diagnosticCorrelationId,
        requiredPermissionKey,
        result,
        sourceKind: EffectivePermissionResolutionSourceKinds.none,
        roleAssignmentCount: 0,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
        targetSummary: this.resolveTargetSummary(request),
        matchedWorkspaceIds: Object.freeze([]),
        synthesizedFallbackUsed: request.target.kind === AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        evidenceMissing: Object.freeze([
          AuthorizationDiagnosticEvidenceKinds.roleAssignmentsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.permissionGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.sharingGrantsUnavailable,
          AuthorizationDiagnosticEvidenceKinds.upstreamFailure,
        ]),
      });
      this.logInfo({
        event: "auth.decision.completed",
        details: Object.freeze({
          diagnosticCorrelationId,
          outcome: result.decision.isAllowed ? "allow" : "deny",
          reasonCode: result.decision.reasonCode,
          sourceKind: EffectivePermissionResolutionSourceKinds.none,
          targetKind: request.target.kind,
          requiredPermissionKey,
        }),
      });
      return result;
    }
  }

  private emitPermissionSnapshotDiagnostic(input: {
    readonly request: AuthorizationPolicyDecisionEvaluationRequest;
    readonly actorUserIdentityId?: string;
    readonly diagnosticCorrelationId: string;
    readonly requiredPermissionKey: string;
    readonly roleAssignmentCount: number;
    readonly permissionGrantCount: number;
    readonly sharingGrantCount: number;
    readonly sharingPolicyMetadataCount: number;
    readonly targetWorkspaceId?: string;
    readonly targetIdentifier: string;
    readonly targetResourceType: string;
    readonly targetResourceFamily?: AuthorizationResourceFamily;
    readonly matchedWorkspaceIds: ReadonlyArray<string>;
    readonly synthesizedFallbackUsed: boolean;
    readonly resourcePolicyMetadataMissing: boolean;
  }): void {
    try {
      emitAuthorizationDiagnosticRecord({
        logger: this.diagnosticsLogger,
        event: "authorization.permission-snapshot.diagnostic",
        outcome: AuthorizationDiagnosticOutcomes.observed,
        reasonCode: input.resourcePolicyMetadataMissing
          ? AuthorizationDecisionReasonCodes.resourcePolicyMetadataNotFound
          : "authorization.permission-snapshot.captured",
        denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.permissionSnapshot,
        correlationId: input.diagnosticCorrelationId,
        actorIdentityId: input.actorUserIdentityId,
        actorActiveWorkspaceId: normalizeOptional(input.request.actor.activeWorkspaceId),
        requiredPermissionKey: input.requiredPermissionKey,
        target: Object.freeze({
          targetKind: input.request.target.kind,
          targetIdentifier: input.targetIdentifier,
          targetWorkspaceId: input.targetWorkspaceId,
          targetResourceFamily: input.targetResourceFamily,
          targetResourceType: input.targetResourceType,
        }),
        counts: Object.freeze({
          roleAssignmentCount: input.roleAssignmentCount,
          permissionGrantCount: input.permissionGrantCount,
          sharingGrantCount: input.sharingGrantCount,
          sharingPolicyMetadataCount: input.sharingPolicyMetadataCount,
        }),
        extensions: Object.freeze({
          "authorization.permission-snapshot.retrieved-role-assignment-count": input.roleAssignmentCount,
          "authorization.permission-snapshot.retrieved-permission-grant-count": input.permissionGrantCount,
          "authorization.permission-snapshot.retrieved-sharing-grant-count": input.sharingGrantCount,
          "authorization.permission-snapshot.retrieved-sharing-policy-metadata-count": input.sharingPolicyMetadataCount,
          "authorization.permission-snapshot.empty-role-assignments": input.roleAssignmentCount === 0,
          "authorization.permission-snapshot.empty-permission-grants": input.permissionGrantCount === 0,
          "authorization.permission-snapshot.empty-sharing-grants": input.sharingGrantCount === 0,
          "authorization.permission-snapshot.resource-policy-metadata-missing": input.resourcePolicyMetadataMissing,
          "authorization.permission-snapshot.target-workspace-id": input.targetWorkspaceId,
          "authorization.permission-snapshot.matched-workspace-ids": input.matchedWorkspaceIds,
          "authorization.permission-snapshot.synthesized-fallback-used": input.synthesizedFallbackUsed,
        }),
      });
    } catch (error) {
      this.logInfo({
        event: "authorization.decision-diagnostic.emission-failed",
        details: Object.freeze({
          stage: AuthorizationDiagnosticProvenanceStages.permissionSnapshot,
          diagnosticCorrelationId: input.diagnosticCorrelationId,
          targetKind: input.request.target.kind,
          requiredPermissionKey: input.requiredPermissionKey,
          reasonCode: input.resourcePolicyMetadataMissing
            ? AuthorizationDecisionReasonCodes.resourcePolicyMetadataNotFound
            : "authorization.permission-snapshot.captured",
          sourceKind: "not-evaluated",
          error: error instanceof Error ? error.message : "authorization-diagnostic-emission-failed",
        }),
      });
    }
  }

  private emitFinalDecisionDiagnostic(input: {
    readonly request: AuthorizationPolicyDecisionEvaluationRequest;
    readonly actorUserIdentityId?: string;
    readonly diagnosticCorrelationId: string;
    readonly requiredPermissionKey: string;
    readonly result: AuthorizationPolicyDecisionEvaluationResult;
    readonly sourceKind: string;
    readonly roleAssignmentCount: number;
    readonly permissionGrantCount: number;
    readonly sharingGrantCount: number;
    readonly applicableScopeCount?: number;
    readonly targetSummary: {
      readonly targetWorkspaceId?: string;
      readonly targetIdentifier: string;
      readonly targetResourceType: string;
      readonly targetResourceFamily?: AuthorizationResourceFamily;
    };
    readonly matchedWorkspaceIds: ReadonlyArray<string>;
    readonly synthesizedFallbackUsed: boolean;
    readonly visibilityFallbackUsed?: boolean;
    readonly evidenceMissing?: ReadonlyArray<string>;
  }): void {
    this.emitDiagnosticSafely({
      stage: AuthorizationDiagnosticProvenanceStages.finalDecisionEmission,
      request: input.request,
      diagnosticCorrelationId: input.diagnosticCorrelationId,
      result: input.result,
      sourceKind: input.sourceKind,
      evidenceMissing: input.evidenceMissing,
      emit: () => emitAuthorizationDiagnosticRecord({
        logger: this.diagnosticsLogger,
        event: "authorization.final-decision.diagnostic",
        outcome: input.result.decision.outcome,
        reasonCode: input.result.decision.reasonCode,
        denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.finalDecisionEmission,
        correlationId: input.diagnosticCorrelationId,
        actorIdentityId: input.actorUserIdentityId,
        actorActiveWorkspaceId: normalizeOptional(input.request.actor.activeWorkspaceId),
        requiredPermissionKey: input.requiredPermissionKey,
        matchedSourceKind: this.resolveDiagnosticMatchedSourceKind(input.result, input.sourceKind),
        target: Object.freeze({
          targetKind: input.request.target.kind,
          targetIdentifier: input.targetSummary.targetIdentifier,
          targetWorkspaceId: input.targetSummary.targetWorkspaceId,
          targetResourceFamily: input.targetSummary.targetResourceFamily,
          targetResourceType: input.targetSummary.targetResourceType,
        }),
        counts: Object.freeze({
          roleAssignmentCount: input.roleAssignmentCount,
          permissionGrantCount: input.permissionGrantCount,
          sharingGrantCount: input.sharingGrantCount,
          applicableScopeCount: input.applicableScopeCount,
        }),
        evidence: Object.freeze({
          roleAssignmentIds: input.result.decision.matchedRoleAssignmentIds,
          permissionGrantIds: input.result.decision.matchedPermissionGrantIds,
          sharingGrantIds: input.result.decision.matchedSharingGrantIds,
          missing: input.evidenceMissing,
        }),
        extensions: Object.freeze({
          "authorization.final-decision.matched-workspace-ids": input.matchedWorkspaceIds,
          "authorization.final-decision.synthesized-fallback-used": input.synthesizedFallbackUsed,
          "authorization.final-decision.visibility-fallback-used": input.visibilityFallbackUsed === true,
        }),
      }),
    });
  }

  private emitEvaluatorResolutionDiagnostic(input: {
    readonly request: AuthorizationPolicyDecisionEvaluationRequest;
    readonly actorUserIdentityId?: string;
    readonly diagnosticCorrelationId: string;
    readonly requiredPermissionKey: string;
    readonly result: AuthorizationPolicyDecisionEvaluationResult;
    readonly sourceKind: string;
    readonly roleAssignmentCount: number;
    readonly permissionGrantCount: number;
    readonly sharingGrantCount: number;
    readonly applicableScopeCount?: number;
    readonly targetSummary: {
      readonly targetWorkspaceId?: string;
      readonly targetIdentifier: string;
      readonly targetResourceType: string;
      readonly targetResourceFamily?: AuthorizationResourceFamily;
    };
    readonly matchedWorkspaceIds: ReadonlyArray<string>;
    readonly synthesizedFallbackUsed: boolean;
    readonly visibilityFallbackUsed?: boolean;
    readonly evidenceMissing?: ReadonlyArray<string>;
  }): void {
    this.emitDiagnosticSafely({
      stage: AuthorizationDiagnosticProvenanceStages.evaluatorResolution,
      request: input.request,
      diagnosticCorrelationId: input.diagnosticCorrelationId,
      result: input.result,
      sourceKind: input.sourceKind,
      evidenceMissing: input.evidenceMissing,
      emit: () => emitAuthorizationDiagnosticRecord({
        logger: this.diagnosticsLogger,
        event: "authorization.evaluator-resolution.diagnostic",
        outcome: input.result.decision.outcome,
        reasonCode: input.result.decision.reasonCode,
        denialProvenanceStage: AuthorizationDiagnosticProvenanceStages.evaluatorResolution,
        correlationId: input.diagnosticCorrelationId,
        actorIdentityId: input.actorUserIdentityId,
        actorActiveWorkspaceId: normalizeOptional(input.request.actor.activeWorkspaceId),
        requiredPermissionKey: input.requiredPermissionKey,
        matchedSourceKind: this.resolveDiagnosticMatchedSourceKind(input.result, input.sourceKind),
        target: Object.freeze({
          targetKind: input.request.target.kind,
          targetIdentifier: input.targetSummary.targetIdentifier,
          targetWorkspaceId: input.targetSummary.targetWorkspaceId,
          targetResourceFamily: input.targetSummary.targetResourceFamily,
          targetResourceType: input.targetSummary.targetResourceType,
        }),
        counts: Object.freeze({
          roleAssignmentCount: input.roleAssignmentCount,
          permissionGrantCount: input.permissionGrantCount,
          sharingGrantCount: input.sharingGrantCount,
          applicableScopeCount: input.applicableScopeCount,
        }),
        evidence: Object.freeze({
          roleAssignmentIds: input.result.decision.matchedRoleAssignmentIds,
          permissionGrantIds: input.result.decision.matchedPermissionGrantIds,
          sharingGrantIds: input.result.decision.matchedSharingGrantIds,
          missing: input.evidenceMissing,
        }),
        extensions: Object.freeze({
          "authorization.evaluator-resolution.source-kind": input.sourceKind,
          "authorization.evaluator-resolution.matched-workspace-ids": input.matchedWorkspaceIds,
          "authorization.evaluator-resolution.synthesized-fallback-used": input.synthesizedFallbackUsed,
          "authorization.evaluator-resolution.visibility-fallback-used": input.visibilityFallbackUsed === true,
        }),
      }),
    });
  }

  private emitDecisionDiagnostics(input: {
    readonly request: AuthorizationPolicyDecisionEvaluationRequest;
    readonly actorUserIdentityId?: string;
    readonly diagnosticCorrelationId: string;
    readonly requiredPermissionKey: string;
    readonly result: AuthorizationPolicyDecisionEvaluationResult;
    readonly sourceKind: string;
    readonly roleAssignmentCount: number;
    readonly permissionGrantCount: number;
    readonly sharingGrantCount: number;
    readonly applicableScopeCount?: number;
    readonly targetSummary: {
      readonly targetWorkspaceId?: string;
      readonly targetIdentifier: string;
      readonly targetResourceType: string;
      readonly targetResourceFamily?: AuthorizationResourceFamily;
    };
    readonly matchedWorkspaceIds: ReadonlyArray<string>;
    readonly synthesizedFallbackUsed: boolean;
    readonly visibilityFallbackUsed?: boolean;
    readonly evidenceMissing?: ReadonlyArray<string>;
  }): void {
    this.emitEvaluatorResolutionDiagnostic(input);
    this.emitFinalDecisionDiagnostic(input);
  }

  private resolveDiagnosticMatchedSourceKind(
    result: AuthorizationPolicyDecisionEvaluationResult,
    sourceKind: string,
  ) {
    const mapped = toAuthorizationDiagnosticMatchedSourceKind(sourceKind);
    if (result.decision.outcome === PolicyDecisionOutcomes.deny) {
      if (mapped === AuthorizationDiagnosticMatchedSourceKinds.notEvaluated) {
        return AuthorizationDiagnosticMatchedSourceKinds.none;
      }
      return mapped;
    }

    if (
      mapped === AuthorizationDiagnosticMatchedSourceKinds.ownerOverride
      || mapped === AuthorizationDiagnosticMatchedSourceKinds.roleGrant
      || mapped === AuthorizationDiagnosticMatchedSourceKinds.permissionGrant
      || mapped === AuthorizationDiagnosticMatchedSourceKinds.sharingGrant
      || mapped === AuthorizationDiagnosticMatchedSourceKinds.visibilityRule
    ) {
      return mapped;
    }

    if (result.decision.reasonCode === AuthorizationDecisionReasonCodes.ownerOverride) {
      return AuthorizationDiagnosticMatchedSourceKinds.ownerOverride;
    }
    if (result.decision.reasonCode === AuthorizationDecisionReasonCodes.matchedRoleGrant) {
      return AuthorizationDiagnosticMatchedSourceKinds.roleGrant;
    }
    if (result.decision.reasonCode === AuthorizationDecisionReasonCodes.matchedPermissionGrant) {
      return AuthorizationDiagnosticMatchedSourceKinds.permissionGrant;
    }
    if (result.decision.reasonCode === AuthorizationDecisionReasonCodes.matchedSharingGrant) {
      return AuthorizationDiagnosticMatchedSourceKinds.sharingGrant;
    }
    if (
      result.decision.reasonCode === AuthorizationDecisionReasonCodes.visibilityWorkspaceMember
      || result.decision.reasonCode === AuthorizationDecisionReasonCodes.visibilityPublished
    ) {
      return AuthorizationDiagnosticMatchedSourceKinds.visibilityRule;
    }
    if (result.decision.matchedRoleAssignmentIds.length > 0) {
      return AuthorizationDiagnosticMatchedSourceKinds.roleGrant;
    }
    if (result.decision.matchedPermissionGrantIds.length > 0) {
      return AuthorizationDiagnosticMatchedSourceKinds.permissionGrant;
    }
    if (result.decision.matchedSharingGrantIds.length > 0) {
      return AuthorizationDiagnosticMatchedSourceKinds.sharingGrant;
    }
    return AuthorizationDiagnosticMatchedSourceKinds.notEvaluated;
  }

  private resolveTargetSummary(request: AuthorizationPolicyDecisionEvaluationRequest): {
    readonly targetWorkspaceId?: string;
    readonly targetIdentifier: string;
    readonly targetResourceType: string;
    readonly targetResourceFamily?: AuthorizationResourceFamily;
  } {
    if (request.target.kind === AuthorizationPolicyEvaluationTargetKinds.resourceInstance) {
      return Object.freeze({
        targetWorkspaceId: undefined,
        targetIdentifier: request.target.resource.resourceId,
        targetResourceType: request.target.resource.resourceType,
        targetResourceFamily: request.target.resource.resourceFamily,
      });
    }

    return Object.freeze({
      targetWorkspaceId: request.target.workspaceId,
      targetIdentifier: `workspace-capability:${request.target.workspaceId}:${request.target.capabilityResourceType}`,
      targetResourceType: request.target.capabilityResourceType,
      targetResourceFamily: undefined,
    });
  }

  private emitDiagnosticSafely(input: {
    readonly stage: string;
    readonly request: AuthorizationPolicyDecisionEvaluationRequest;
    readonly diagnosticCorrelationId: string;
    readonly result: AuthorizationPolicyDecisionEvaluationResult;
    readonly sourceKind: string;
    readonly evidenceMissing?: ReadonlyArray<string>;
    readonly emit: () => void;
  }): void {
    try {
      input.emit();
    } catch (error) {
      this.logInfo({
        event: "authorization.decision-diagnostic.emission-failed",
        details: Object.freeze({
          stage: input.stage,
          diagnosticCorrelationId: input.diagnosticCorrelationId,
          targetKind: input.request.target.kind,
          requiredPermissionKey: input.result.decision.requiredPermissionKey,
          outcome: input.result.decision.outcome,
          reasonCode: input.result.decision.reasonCode,
          sourceKind: input.sourceKind,
          evidenceMissing: input.evidenceMissing,
          error: error instanceof Error ? error.message : "authorization-diagnostic-emission-failed",
        }),
      });
    }
  }

  private logInfo(event: { readonly event: string; readonly details?: Readonly<Record<string, unknown>> }): void {
    try {
      this.diagnosticsLogger.info(event);
    } catch {
      // Diagnostic logging must not alter authorization outcomes.
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
