import {
  createActorContext,
  createPermissionKey,
  createResourcePolicyContext,
  createSharingPolicy,
  createSharingGrant,
  AuthorizationDomainError,
} from "../../../domain/authorization/AuthorizationDomain";
import type {
  AuthorizationPolicyEvaluationDecisionDto,
  AuthorizationPolicyEvaluationRequestDto,
  AuthorizationSharingGrantRecord,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationPolicyEvaluationEventTypes,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { AuthorizationPolicyEvaluationPorts } from "../ports/AuthorizationPolicyEvaluationPorts";

export const EvaluateAuthorizationPolicyErrorCodes = Object.freeze({
  invalidRequest: "authorization-evaluation-invalid-request",
  resourceNotFound: "authorization-evaluation-resource-not-found",
  invalidContext: "authorization-evaluation-invalid-context",
});

export type EvaluateAuthorizationPolicyErrorCode =
  typeof EvaluateAuthorizationPolicyErrorCodes[keyof typeof EvaluateAuthorizationPolicyErrorCodes];

export interface EvaluateAuthorizationPolicyError {
  readonly code: EvaluateAuthorizationPolicyErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type EvaluateAuthorizationPolicyUseCaseOutcome =
  | {
    readonly ok: true;
    readonly value: AuthorizationPolicyEvaluationDecisionDto;
  }
  | {
    readonly ok: false;
    readonly error: EvaluateAuthorizationPolicyError;
  };

export interface EvaluateAuthorizationPolicyClock {
  now(): Date;
}

interface EvaluateAuthorizationPolicyUseCaseDependencies {
  readonly ports: AuthorizationPolicyEvaluationPorts;
  readonly clock?: EvaluateAuthorizationPolicyClock;
}

export class EvaluateAuthorizationPolicyUseCase {
  private readonly clock: EvaluateAuthorizationPolicyClock;

  public constructor(private readonly dependencies: EvaluateAuthorizationPolicyUseCaseDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    request: AuthorizationPolicyEvaluationRequestDto,
  ): Promise<EvaluateAuthorizationPolicyUseCaseOutcome> {
    const actorUserIdentityId = normalizeOptional(request.actor.actorUserIdentityId);
    const actorServiceId = normalizeOptional(request.actor.actorServiceId);
    if (!actorUserIdentityId && !actorServiceId) {
      return this.failure(
        EvaluateAuthorizationPolicyErrorCodes.invalidRequest,
        "actor.actorUserIdentityId or actor.actorServiceId is required.",
      );
    }

    const asOf = normalizeOptional(request.asOf);
    const requiredPermissionKey = this.normalizePermissionKey(request.requiredPermissionKey);
    if (!requiredPermissionKey) {
      return this.failure(
        EvaluateAuthorizationPolicyErrorCodes.invalidRequest,
        "requiredPermissionKey must be a valid namespaced permission key.",
      );
    }

    const resourcePolicyMetadata = await this.dependencies.ports.resourcePolicyMetadataReadRepository.findResourcePolicyMetadata({
      resource: request.resource,
      asOf,
    });

    if (!resourcePolicyMetadata) {
      return this.failure(
        EvaluateAuthorizationPolicyErrorCodes.resourceNotFound,
        `Resource '${request.resource.resourceType}:${request.resource.resourceId}' policy metadata was not found.`,
      );
    }

    const actorMembershipsPromise = actorUserIdentityId
      ? this.dependencies.ports.actorMembershipReadRepository.listActorMemberships({
        actorUserIdentityId,
        workspaceId: resourcePolicyMetadata.workspaceId,
        asOf,
      })
      : Promise.resolve([]);

    const [actorMemberships, roleGrantSnapshot, sharingGrantRecords] = await Promise.all([
      actorMembershipsPromise,
      this.dependencies.ports.roleGrantReadRepository.getActorRoleGrantSnapshot({
        actor: request.actor,
        resource: request.resource,
        asOf,
      }),
      this.dependencies.ports.sharingGrantReadRepository.listSharingGrants({
        resource: request.resource,
        asOf,
      }),
    ]);

    try {
      const actorContext = createActorContext({
        actorUserIdentityId,
        actorServiceId,
        activeWorkspaceId: normalizeOptional(request.actor.activeWorkspaceId),
        authenticatedAt: normalizeOptional(request.actor.authenticatedAt),
        roleAssignments: roleGrantSnapshot.roleAssignments,
        permissionGrants: roleGrantSnapshot.permissionGrants,
      });

      const resourceContext = createResourcePolicyContext({
        resourceType: resourcePolicyMetadata.resourceType,
        resourceId: resourcePolicyMetadata.resourceId,
        ownerUserIdentityId: resourcePolicyMetadata.ownerUserIdentityId,
        ownershipScope: resourcePolicyMetadata.ownershipScope,
        workspaceId: resourcePolicyMetadata.workspaceId,
        visibility: resourcePolicyMetadata.visibility,
        sharingPolicy: createSharingPolicy({
          mode: resourcePolicyMetadata.sharingPolicyMode,
          allowResharing: resourcePolicyMetadata.allowResharing,
        }),
        sharingGrants: sharingGrantRecords.map((record) => this.toSharingGrant(record)),
        isPublishedCapable: resourcePolicyMetadata.isPublishedCapable,
        publishedAt: resourcePolicyMetadata.publishedAt,
      });

      const evaluationResult = await this.dependencies.ports.policyEvaluator.evaluatePolicy({
        actor: actorContext,
        resource: resourceContext,
        requiredPermissionKey,
        asOf,
      });

      const outcome: AuthorizationPolicyEvaluationDecisionDto = Object.freeze({
        decision: evaluationResult.decision,
        resolvedContext: Object.freeze({
          actorMemberships: Object.freeze([...actorMemberships]),
          roleAssignments: roleGrantSnapshot.roleAssignments,
          permissionGrants: roleGrantSnapshot.permissionGrants,
          resourcePolicyMetadata,
          sharingGrants: Object.freeze([...sharingGrantRecords]),
        }),
      });

      await this.recordEventBestEffort(request, outcome);

      return {
        ok: true,
        value: outcome,
      };
    } catch (error) {
      const message = error instanceof AuthorizationDomainError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Authorization evaluation context could not be resolved.";

      return this.failure(EvaluateAuthorizationPolicyErrorCodes.invalidContext, message);
    }
  }

  private normalizePermissionKey(value: string): string | undefined {
    try {
      return createPermissionKey(value);
    } catch {
      return undefined;
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

  private async recordEventBestEffort(
    request: AuthorizationPolicyEvaluationRequestDto,
    result: AuthorizationPolicyEvaluationDecisionDto,
  ): Promise<void> {
    const recorder = this.dependencies.ports.policyEventRecorder;
    if (!recorder) {
      return;
    }

    try {
      await recorder.recordPolicyEvaluationEvent({
        type: AuthorizationPolicyEvaluationEventTypes.evaluated,
        occurredAt: this.clock.now().toISOString(),
        correlationId: normalizeOptional(request.correlationId),
        request,
        result,
      });
    } catch {
      // Best-effort by design; adapters can fail independently from authorization flow.
    }
  }

  private failure(
    code: EvaluateAuthorizationPolicyErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): EvaluateAuthorizationPolicyUseCaseOutcome {
    return {
      ok: false,
      error: Object.freeze({
        code,
        message,
        details,
      }),
    };
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
