import type { ListAuthorizationEffectiveAccessUseCase } from "../../../src/application/authorization/use-cases/ListAuthorizationEffectiveAccessUseCase";
import type { GrantAuthorizationSharingAccessUseCase } from "../../../src/application/authorization/use-cases/GrantAuthorizationSharingAccessUseCase";
import type { RevokeAuthorizationSharingAccessUseCase } from "../../../src/application/authorization/use-cases/RevokeAuthorizationSharingAccessUseCase";
import type { UpdateAuthorizationVisibilityUseCase } from "../../../src/application/authorization/use-cases/UpdateAuthorizationVisibilityUseCase";
import type { BulkGrantAuthorizationWorkspaceRoleAccessUseCase } from "../../../src/application/authorization/use-cases/BulkGrantAuthorizationWorkspaceRoleAccessUseCase";
import type { IAuthorizationPolicyDecisionEvaluator } from "../../../src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { IAuthorizationSharingGrantPersistenceRepository } from "../../../src/application/authorization/ports/IAuthorizationSharingGrantPersistenceRepository";
import type { IAuthorizationResourcePolicyMetadataPersistenceRepository } from "../../../src/application/authorization/ports/IAuthorizationResourcePolicyMetadataPersistenceRepository";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "../../../src/application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository";
import { AuthorizationPolicyEvaluationTargetKinds } from "../../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import { AuthorizationAdministrationErrorCodes } from "../../../src/application/authorization/use-cases/AuthorizationAdministrationUseCaseShared";
import {
  AuthorizationManagementApiErrorCodes,
  type AuthorizationAccessStateApiRequest,
  type AuthorizationAccessStateApiResponse,
  type BulkGrantAuthorizationWorkspaceRoleAccessApiRequest,
  type BulkGrantAuthorizationWorkspaceRoleAccessApiResponse,
  type AuthorizationManagementApiError,
  type AuthorizationManagementApiResponse,
  type AuthorizationResourcePolicyMetadataApiRecord,
  type AuthorizationSharingGrantApiRecord,
  type AuthorizationSharingTargetApiRecord,
  type AuthorizationWorkspaceSharingReportApiRequest,
  type AuthorizationWorkspaceSharingReportApiResponse,
  type GrantAuthorizationSharingAccessApiRequest,
  type GrantAuthorizationSharingAccessApiResponse,
  type RevokeAuthorizationSharingAccessApiRequest,
  type RevokeAuthorizationSharingAccessApiResponse,
  type UpdateAuthorizationVisibilityApiRequest,
  type UpdateAuthorizationVisibilityApiResponse,
} from "./sdk/PublicAuthorizationManagementApiContract";

interface AuthorizationManagementBackendApiDependencies {
  readonly grantSharingAccessUseCase: GrantAuthorizationSharingAccessUseCase;
  readonly revokeSharingAccessUseCase: RevokeAuthorizationSharingAccessUseCase;
  readonly updateVisibilityUseCase: UpdateAuthorizationVisibilityUseCase;
  readonly bulkGrantWorkspaceRoleAccessUseCase: BulkGrantAuthorizationWorkspaceRoleAccessUseCase;
  readonly listEffectiveAccessUseCase: ListAuthorizationEffectiveAccessUseCase;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly roleAssignmentPersistenceRepository: IAuthorizationRoleAssignmentPersistenceRepository;
  readonly sharingGrantPersistenceRepository: IAuthorizationSharingGrantPersistenceRepository;
  readonly resourcePolicyMetadataPersistenceRepository: IAuthorizationResourcePolicyMetadataPersistenceRepository;
  readonly clock?: {
    now(): Date;
  };
}

export class AuthorizationManagementBackendApi {
  private readonly clock: { now(): Date };

  public constructor(private readonly dependencies: AuthorizationManagementBackendApiDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async updateVisibility(
    request: UpdateAuthorizationVisibilityApiRequest,
  ): Promise<AuthorizationManagementApiResponse<UpdateAuthorizationVisibilityApiResponse>> {
    const outcome = await this.dependencies.updateVisibilityUseCase.execute({
      request: {
        actorUserIdentityId: request.actorUserIdentityId,
        subject: request.resource,
        workspaceId: request.workspaceId,
        visibility: request.visibility,
        sharingPolicyMode: request.sharingPolicyMode,
        allowResharing: request.allowResharing,
        sharingGrants: request.sharingGrants,
        isPublishedCapable: request.isPublishedCapable,
        publishedAt: request.publishedAt,
      },
      expectedRevision: request.expectedRevision,
      reason: request.reason,
      correlationId: request.correlationId,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return this.failedFromAdministrationOutcome(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        metadata: toMetadataApiRecord(outcome.value.metadataMutation.record),
        metadataChanged: outcome.value.metadataMutation.changed,
        sharingGrantMutations: Object.freeze(outcome.value.sharingGrantMutations.map((mutation) => Object.freeze({
          grantId: mutation.record.id,
          changed: mutation.changed,
          revokedAt: mutation.record.revokedAt,
        }))),
      }),
    });
  }

  public async grantSharingAccess(
    request: GrantAuthorizationSharingAccessApiRequest,
  ): Promise<AuthorizationManagementApiResponse<GrantAuthorizationSharingAccessApiResponse>> {
    const resourceMetadata = await this.dependencies.resourcePolicyMetadataPersistenceRepository.findResourcePolicyMetadata(request.resource);
    if (!resourceMetadata || resourceMetadata.deletedAt) {
      return this.failed(AuthorizationManagementApiErrorCodes.notFound, "Resource policy metadata was not found.");
    }

    const outcome = await this.dependencies.grantSharingAccessUseCase.execute({
      request: {
        operation: "upsert",
        actorUserIdentityId: request.actorUserIdentityId,
        resource: request.resource,
        workspaceId: request.workspaceId ?? resourceMetadata.workspaceId,
        visibility: request.visibility ?? resourceMetadata.visibility,
        grant: {
          id: request.grant.id,
          target: request.grant.target,
          permissionKeys: request.grant.permissionKeys,
        },
      },
      expectedRevision: request.expectedRevision,
      reason: request.reason,
      correlationId: request.correlationId,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return this.failedFromAdministrationOutcome(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        grant: toSharingGrantApiRecord(outcome.value.record),
        changed: outcome.value.changed,
      }),
    });
  }

  public async bulkGrantWorkspaceRoleAccess(
    request: BulkGrantAuthorizationWorkspaceRoleAccessApiRequest,
  ): Promise<AuthorizationManagementApiResponse<BulkGrantAuthorizationWorkspaceRoleAccessApiResponse>> {
    const outcome = await this.dependencies.bulkGrantWorkspaceRoleAccessUseCase.execute({
      request: {
        actorUserIdentityId: request.actorUserIdentityId,
        workspaceId: request.workspaceId,
        roleKey: request.roleKey,
        resources: request.resources,
        permissionKeys: request.permissionKeys,
      },
      reason: request.reason,
      correlationId: request.correlationId,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return this.failedFromAdministrationOutcome(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        workspaceId: outcome.value.workspaceId,
        roleKey: outcome.value.roleKey,
        permissionKeys: outcome.value.permissionKeys,
        totalResources: outcome.value.totalResources,
        succeededResources: outcome.value.succeededResources,
        failedResources: outcome.value.failedResources,
        results: Object.freeze(outcome.value.results.map((result) => {
          if (result.status === "failed") {
            return Object.freeze({
              resource: result.resource,
              status: "failed" as const,
              error: Object.freeze({
                code: result.error.code,
                message: result.error.message,
                reasonCode: toReasonCode(result.error.details),
              }),
            });
          }

          return Object.freeze({
            resource: result.resource,
            status: result.status,
            grantId: result.grantId,
            changed: result.changed,
            revision: result.mutation.record.revision,
          });
        })),
      }),
    });
  }

  public async revokeSharingAccess(
    request: RevokeAuthorizationSharingAccessApiRequest,
  ): Promise<AuthorizationManagementApiResponse<RevokeAuthorizationSharingAccessApiResponse>> {
    const resourceMetadata = await this.dependencies.resourcePolicyMetadataPersistenceRepository.findResourcePolicyMetadata(request.resource);
    if (!resourceMetadata || resourceMetadata.deletedAt) {
      return this.failed(AuthorizationManagementApiErrorCodes.notFound, "Resource policy metadata was not found.");
    }

    const outcome = await this.dependencies.revokeSharingAccessUseCase.execute({
      request: {
        operation: "revoke",
        actorUserIdentityId: request.actorUserIdentityId,
        resource: request.resource,
        workspaceId: request.workspaceId ?? resourceMetadata.workspaceId,
        visibility: request.visibility ?? resourceMetadata.visibility,
        grantId: request.grantId,
      },
      expectedRevision: request.expectedRevision,
      reason: request.reason,
      correlationId: request.correlationId,
      metadata: request.metadata,
    });

    if (!outcome.ok) {
      return this.failedFromAdministrationOutcome(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        grant: toSharingGrantApiRecord(outcome.value.record),
        changed: outcome.value.changed,
      }),
    });
  }

  public async readAccessState(
    request: AuthorizationAccessStateApiRequest,
  ): Promise<AuthorizationManagementApiResponse<AuthorizationAccessStateApiResponse>> {
    const authorization = await this.assertAccessStateReadAuthorized(request);
    if (authorization) {
      return authorization;
    }

    const inspectedActorUserIdentityId = request.inspectedActorUserIdentityId?.trim() || request.actorUserIdentityId;
    const outcome = await this.dependencies.listEffectiveAccessUseCase.execute({
      actor: {
        actorUserIdentityId: inspectedActorUserIdentityId,
        activeWorkspaceId: undefined,
      },
      resource: request.resource,
      asOf: request.asOf,
      includeDenied: request.includeDenied,
    });

    if (!outcome.ok) {
      return this.failedFromAdministrationOutcome(outcome.error.code, outcome.error.message, outcome.error.details);
    }

    const sharingGrants = await this.dependencies.sharingGrantPersistenceRepository.listSharingGrants({
      resource: request.resource,
      asOf: request.asOf,
      includeRevoked: request.includeRevokedSharingGrants,
      includeExpired: true,
    });

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        inspectorActorUserIdentityId: request.actorUserIdentityId,
        inspectedActorUserIdentityId,
        resource: request.resource,
        resourcePolicyMetadata: toMetadataApiRecord({
          ...outcome.value.resourcePolicyMetadata,
          revision: 0,
        }),
        roleAssignmentIds: Object.freeze(outcome.value.roleAssignments.map((assignment) => assignment.id)),
        directPermissionGrantIds: outcome.value.permissionGrantIds,
        sharingGrants: Object.freeze(sharingGrants.map((grant) => toSharingGrantApiRecord(grant))),
        permissions: Object.freeze(outcome.value.permissions.map((entry) => Object.freeze({
          permissionKey: entry.permissionKey,
          isAllowed: entry.decision.isAllowed,
          outcome: entry.decision.outcome,
          reasonCode: entry.decision.reasonCode,
          reason: entry.decision.reason,
          denialReason: entry.decision.denialReason,
          matchedRoleAssignmentIds: entry.decision.matchedRoleAssignmentIds,
          matchedPermissionGrantIds: entry.decision.matchedPermissionGrantIds,
          matchedSharingGrantIds: entry.decision.matchedSharingGrantIds,
          explanation: entry.explanation,
        }))),
      }),
    });
  }

  public async readWorkspaceSharingReport(
    request: AuthorizationWorkspaceSharingReportApiRequest,
  ): Promise<AuthorizationManagementApiResponse<AuthorizationWorkspaceSharingReportApiResponse>> {
    const workspaceId = request.workspaceId.trim();
    if (!workspaceId) {
      return this.failed(AuthorizationManagementApiErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const asOf = request.asOf?.trim() || this.clock.now().toISOString();
    const asOfTime = Date.parse(asOf);
    if (!Number.isFinite(asOfTime)) {
      return this.failed(AuthorizationManagementApiErrorCodes.invalidRequest, "asOf must be a valid ISO-8601 timestamp.");
    }

    const authorization = await this.assertWorkspaceReportReadAuthorized(request.actorUserIdentityId, workspaceId, asOf);
    if (authorization) {
      return authorization;
    }

    const includeRevokedRoleAssignments = request.includeRevokedRoleAssignments ?? true;
    const includeRevokedSharingGrants = request.includeRevokedSharingGrants ?? true;
    const recentSharingMutationsLimit = normalizeRecentLimit(request.recentSharingMutationsLimit);

    const roleAssignments = await this.dependencies.roleAssignmentPersistenceRepository.listRoleAssignments({
      workspaceId,
      includeRevoked: includeRevokedRoleAssignments,
      asOf,
      limit: 1000,
      offset: 0,
    });
    const resourcePolicyMetadata = await this.dependencies.resourcePolicyMetadataPersistenceRepository.listResourcePolicyMetadata({
      workspaceId,
      includeDeleted: false,
      asOf,
      limit: 2000,
      offset: 0,
    });
    const sharingGrants = await this.dependencies.sharingGrantPersistenceRepository.listSharingGrants({
      workspaceId,
      includeRevoked: includeRevokedSharingGrants,
      includeExpired: true,
      asOf,
      limit: 5000,
      offset: 0,
    });

    const activeSharingGrantCountByResource = new Map<string, number>();
    for (const grant of sharingGrants) {
      if (!isActiveGrant(grant, asOfTime)) {
        continue;
      }
      const key = toResourceKey(grant.resourceFamily, grant.resourceType, grant.resourceId);
      activeSharingGrantCountByResource.set(key, (activeSharingGrantCountByResource.get(key) ?? 0) + 1);
    }

    const unusualVisibilityPatterns = resourcePolicyMetadata.flatMap((metadata) => {
      const activeSharingGrantCount = activeSharingGrantCountByResource.get(
        toResourceKey(metadata.resourceFamily, metadata.resourceType, metadata.resourceId),
      ) ?? 0;
      const reasonCodes: Array<
        | "private-resource-with-active-sharing-grants"
        | "owner-only-policy-with-active-sharing-grants"
        | "published-visibility-without-published-at"
      > = [];

      if (metadata.visibility === "private" && activeSharingGrantCount > 0) {
        reasonCodes.push("private-resource-with-active-sharing-grants");
      }
      if (metadata.sharingPolicyMode === "owner-only" && activeSharingGrantCount > 0) {
        reasonCodes.push("owner-only-policy-with-active-sharing-grants");
      }
      if (metadata.visibility === "published" && !metadata.publishedAt) {
        reasonCodes.push("published-visibility-without-published-at");
      }

      if (reasonCodes.length === 0) {
        return [];
      }

      return [Object.freeze({
        resource: Object.freeze({
          resourceFamily: metadata.resourceFamily,
          resourceType: metadata.resourceType,
          resourceId: metadata.resourceId,
        }),
        workspaceId: metadata.workspaceId,
        visibility: metadata.visibility,
        sharingPolicyMode: metadata.sharingPolicyMode,
        activeSharingGrantCount,
        reasonCodes: Object.freeze(reasonCodes),
      })];
    });

    const recentSharingMutations = sharingGrants
      .map((grant) => toRecentSharingMutation(grant))
      .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))
      .slice(0, recentSharingMutationsLimit);

    const visibilityDistribution = summarizeVisibility(resourcePolicyMetadata);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        workspaceId,
        asOf,
        generatedAt: this.clock.now().toISOString(),
        roleAssignments: Object.freeze([...roleAssignments]
          .sort((left, right) => Date.parse(right.assignedAt) - Date.parse(left.assignedAt))
          .map((assignment) => Object.freeze({
            roleAssignmentId: assignment.id,
            actorUserIdentityId: assignment.actorUserIdentityId,
            roleKey: assignment.roleKey,
            scope: assignment.scope,
            status: assignment.status,
            workspaceId: assignment.workspaceId,
            resourceFamily: assignment.resourceFamily,
            resourceType: assignment.resourceType,
            resourceId: assignment.resourceId,
            assignedAt: assignment.assignedAt,
            assignedByUserIdentityId: assignment.assignedByUserIdentityId,
            revokedAt: assignment.revokedAt,
            revokedByUserIdentityId: assignment.revokedByUserIdentityId,
          }))),
        resourceVisibilityDistribution: visibilityDistribution,
        unusualVisibilityPatterns: Object.freeze(unusualVisibilityPatterns),
        recentSharingMutations: Object.freeze(recentSharingMutations),
      }),
    });
  }

  private async assertAccessStateReadAuthorized(
    request: AuthorizationAccessStateApiRequest,
  ): Promise<AuthorizationManagementApiResponse<never> | undefined> {
    const permissionsToCheck = [`${request.resource.resourceFamily}.share`, `${request.resource.resourceFamily}.manage`];

    for (const permission of permissionsToCheck) {
      const decision = await this.dependencies.decisionEvaluator.evaluateDecision({
        actor: {
          actorUserIdentityId: request.actorUserIdentityId,
          activeWorkspaceId: undefined,
        },
        requiredPermissionKey: permission,
        target: {
          kind: AuthorizationPolicyEvaluationTargetKinds.resourceInstance,
          resource: request.resource,
        },
        asOf: request.asOf,
      });

      if (decision.decision.isAllowed) {
        return undefined;
      }
    }

    return this.failed(AuthorizationManagementApiErrorCodes.forbidden, "Actor is not authorized to inspect access state.");
  }

  private async assertWorkspaceReportReadAuthorized(
    actorUserIdentityId: string,
    workspaceId: string,
    asOf: string,
  ): Promise<AuthorizationManagementApiResponse<never> | undefined> {
    const decision = await this.dependencies.decisionEvaluator.evaluateDecision({
      actor: {
        actorUserIdentityId,
        activeWorkspaceId: workspaceId,
      },
      requiredPermissionKey: "system.manage",
      target: {
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId,
        capabilityResourceType: "authorization-administration",
      },
      asOf,
    });

    if (decision.decision.isAllowed) {
      return undefined;
    }

    return this.failed(AuthorizationManagementApiErrorCodes.forbidden, "Actor is not authorized to inspect workspace authorization reporting.");
  }

  private failedFromAdministrationOutcome(
    code: string,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ): AuthorizationManagementApiResponse<never> {
    switch (code) {
      case AuthorizationAdministrationErrorCodes.invalidRequest:
        return this.failed(
          AuthorizationManagementApiErrorCodes.invalidRequest,
          message,
          undefined,
          toValidationErrors(details),
        );
      case AuthorizationAdministrationErrorCodes.forbidden:
        return this.failed(AuthorizationManagementApiErrorCodes.forbidden, message, toReasonCode(details));
      case AuthorizationAdministrationErrorCodes.notFound:
        return this.failed(AuthorizationManagementApiErrorCodes.notFound, message);
      case AuthorizationAdministrationErrorCodes.conflict:
      case AuthorizationAdministrationErrorCodes.invalidState:
        return this.failed(AuthorizationManagementApiErrorCodes.conflict, message);
      case AuthorizationAdministrationErrorCodes.highRiskConfirmationRequired:
        return this.failed(AuthorizationManagementApiErrorCodes.conflict, message, toReasonCode(details));
      default:
        return this.failed(AuthorizationManagementApiErrorCodes.internal, message);
    }
  }

  private failed(
    code: AuthorizationManagementApiError["code"],
    message: string,
    reasonCode?: string,
    validationErrors?: AuthorizationManagementApiError["validationErrors"],
  ): AuthorizationManagementApiResponse<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code,
        message,
        reasonCode,
        validationErrors,
      }),
    });
  }
}

function toMetadataApiRecord(record: {
  readonly resourceFamily: AuthorizationResourcePolicyMetadataApiRecord["resourceFamily"];
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerUserIdentityId: string;
  readonly ownershipScope: AuthorizationResourcePolicyMetadataApiRecord["ownershipScope"];
  readonly workspaceId?: string;
  readonly visibility: AuthorizationResourcePolicyMetadataApiRecord["visibility"];
  readonly sharingPolicyMode: AuthorizationResourcePolicyMetadataApiRecord["sharingPolicyMode"];
  readonly allowResharing: boolean;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
  readonly revision?: number;
}): AuthorizationResourcePolicyMetadataApiRecord {
  return Object.freeze({
    resourceFamily: record.resourceFamily,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    ownerUserIdentityId: record.ownerUserIdentityId,
    ownershipScope: record.ownershipScope,
    workspaceId: record.workspaceId,
    visibility: record.visibility,
    sharingPolicyMode: record.sharingPolicyMode,
    allowResharing: record.allowResharing,
    isPublishedCapable: record.isPublishedCapable,
    publishedAt: record.publishedAt,
    revision: record.revision ?? 0,
  });
}

function toSharingGrantApiRecord(record: {
  readonly id: string;
  readonly subject: {
    readonly kind: "user" | "workspace-role" | "workspace" | "public";
    readonly userIdentityId?: string;
    readonly workspaceId?: string;
    readonly roleKey?: string;
  };
  readonly permissionKeys: ReadonlyArray<string>;
  readonly grantedAt: string;
  readonly grantedByUserIdentityId: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly revision?: number;
}): AuthorizationSharingGrantApiRecord {
  return Object.freeze({
    grantId: record.id,
    target: toSharingTarget(record.subject),
    permissionKeys: record.permissionKeys,
    grantedAt: record.grantedAt,
    grantedByUserIdentityId: record.grantedByUserIdentityId,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    revokedByUserIdentityId: record.revokedByUserIdentityId,
    revision: record.revision ?? 0,
  });
}

function toSharingTarget(subject: {
  readonly kind: "user" | "workspace-role" | "workspace" | "public";
  readonly userIdentityId?: string;
  readonly workspaceId?: string;
  readonly roleKey?: string;
}): AuthorizationSharingTargetApiRecord {
  if (subject.kind === "user") {
    return Object.freeze({
      kind: "user" as const,
      userId: subject.userIdentityId as string,
    });
  }
  if (subject.kind === "workspace-role") {
    return Object.freeze({
      kind: "workspace-role" as const,
      workspaceId: subject.workspaceId as string,
      roleKey: subject.roleKey as string,
    });
  }
  if (subject.kind === "workspace") {
    return Object.freeze({
      kind: "workspace" as const,
      workspaceId: subject.workspaceId as string,
    });
  }

  return Object.freeze({
    kind: "public" as const,
  });
}

function toReasonCode(details?: Readonly<Record<string, unknown>>): string | undefined {
  const reasonCode = details?.reasonCode;
  return typeof reasonCode === "string" && reasonCode.trim() ? reasonCode.trim() : undefined;
}

function toValidationErrors(
  details?: Readonly<Record<string, unknown>>,
): ReadonlyArray<Readonly<{ path: string; code: string; message: string }>> | undefined {
  const issues = details?.issues;
  if (!Array.isArray(issues) || issues.length === 0) {
    return undefined;
  }

  const parsed = issues.flatMap((issue) => {
    if (!issue || typeof issue !== "object") {
      return [];
    }

    const rawPath = (issue as { path?: unknown }).path;
    const rawCode = (issue as { code?: unknown }).code;
    const rawMessage = (issue as { message?: unknown }).message;
    const path = typeof rawPath === "string" && rawPath.trim() ? rawPath.trim() : "payload";
    const code = typeof rawCode === "string" && rawCode.trim() ? rawCode.trim() : "custom";
    const message = typeof rawMessage === "string" && rawMessage.trim() ? rawMessage.trim() : "Invalid value.";

    return [Object.freeze({ path, code, message })];
  });

  return parsed.length > 0 ? Object.freeze(parsed) : undefined;
}

function toResourceKey(resourceFamily: string, resourceType: string, resourceId: string): string {
  return `${resourceFamily}:${resourceType}:${resourceId}`;
}

function isActiveGrant(
  grant: {
    readonly grantedAt: string;
    readonly expiresAt?: string;
    readonly revokedAt?: string;
  },
  asOfTime: number,
): boolean {
  const grantedAtTime = Date.parse(grant.grantedAt);
  if (!Number.isFinite(grantedAtTime) || grantedAtTime > asOfTime) {
    return false;
  }

  if (grant.revokedAt) {
    const revokedAtTime = Date.parse(grant.revokedAt);
    if (Number.isFinite(revokedAtTime) && revokedAtTime <= asOfTime) {
      return false;
    }
  }

  if (grant.expiresAt) {
    const expiresAtTime = Date.parse(grant.expiresAt);
    if (Number.isFinite(expiresAtTime) && expiresAtTime <= asOfTime) {
      return false;
    }
  }

  return true;
}

function summarizeVisibility(
  resourcePolicyMetadata: ReadonlyArray<{ readonly visibility: "private" | "workspace" | "shared" | "published" }>,
): Readonly<{
  private: number;
  workspace: number;
  shared: number;
  published: number;
  total: number;
}> {
  let privateCount = 0;
  let workspaceCount = 0;
  let sharedCount = 0;
  let publishedCount = 0;

  for (const metadata of resourcePolicyMetadata) {
    if (metadata.visibility === "private") {
      privateCount += 1;
    } else if (metadata.visibility === "workspace") {
      workspaceCount += 1;
    } else if (metadata.visibility === "shared") {
      sharedCount += 1;
    } else {
      publishedCount += 1;
    }
  }

  return Object.freeze({
    private: privateCount,
    workspace: workspaceCount,
    shared: sharedCount,
    published: publishedCount,
    total: resourcePolicyMetadata.length,
  });
}

function toRecentSharingMutation(grant: {
  readonly id: string;
  readonly resourceFamily: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly subject: {
    readonly kind: "user" | "workspace-role" | "workspace" | "public";
    readonly userIdentityId?: string;
    readonly workspaceId?: string;
    readonly roleKey?: string;
  };
  readonly permissionKeys: ReadonlyArray<string>;
  readonly grantedAt: string;
  readonly grantedByUserIdentityId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
}) {
  const mutationType = grant.revokedAt ? "revoked" : "granted";
  return Object.freeze({
    grantId: grant.id,
    mutationType,
    occurredAt: grant.revokedAt ?? grant.grantedAt,
    actorUserIdentityId: grant.revokedByUserIdentityId ?? grant.grantedByUserIdentityId,
    resource: Object.freeze({
      resourceFamily: grant.resourceFamily,
      resourceType: grant.resourceType,
      resourceId: grant.resourceId,
    }),
    target: toSharingTarget(grant.subject),
    permissionKeys: grant.permissionKeys,
  });
}

function normalizeRecentLimit(value: number | undefined): number {
  if (!Number.isInteger(value)) {
    return 25;
  }

  return Math.min(Math.max(value as number, 1), 100);
}
