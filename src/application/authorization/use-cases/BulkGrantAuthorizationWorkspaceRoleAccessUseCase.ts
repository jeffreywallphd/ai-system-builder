import { ResourceOwnershipScopes, ResourceVisibilities } from "../../../domain/authorization/AuthorizationDomain";
import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationSharingGrantPersistenceRecord,
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import { toAuthorizationResourceLookupKey } from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationBulkWorkspaceRoleSharingGrantRequest } from "../../../shared/schemas/authorization/AuthorizationSchemaContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService, type AuthorizationPolicyMutationServiceClock } from "./AuthorizationPolicyMutationService";
import {
  assertActorAuthorizedForResourcePermission,
  AuthorizationAdministrationErrorCodes,
  AuthorizationUseCaseIdNamespaces,
  type AuthorizationAdministrationError,
  type AuthorizationAdministrationOutcome,
  type AuthorizationUseCaseIdGenerator,
  DefaultAuthorizationUseCaseIdGenerator,
  createAuthorizationMutationEnvelope,
  mapAuthorizationSchemaValidationError,
} from "./AuthorizationAdministrationUseCaseShared";
import type { AuthorizationResourceFamily } from "../../../domain/authorization/AuthorizationPermissionCatalog";
import type { AuthorizationRoleKey } from "../../../domain/authorization/AuthorizationDomain";

export interface BulkGrantAuthorizationWorkspaceRoleAccessUseCaseInput {
  readonly request: unknown;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type BulkGrantAuthorizationWorkspaceRoleAccessResultItem =
  | Readonly<{
    resource: Readonly<{
      resourceFamily: AuthorizationResourceFamily;
      resourceType: string;
      resourceId: string;
    }>;
    status: "created" | "updated" | "unchanged";
    grantId: string;
    changed: boolean;
    mutation: AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>;
  }>
  | Readonly<{
    resource: Readonly<{
      resourceFamily: AuthorizationResourceFamily;
      resourceType: string;
      resourceId: string;
    }>;
    status: "failed";
    error: AuthorizationAdministrationError;
  }>;

export interface BulkGrantAuthorizationWorkspaceRoleAccessUseCaseResult {
  readonly workspaceId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly permissionKeys: ReadonlyArray<string>;
  readonly totalResources: number;
  readonly succeededResources: number;
  readonly failedResources: number;
  readonly results: ReadonlyArray<BulkGrantAuthorizationWorkspaceRoleAccessResultItem>;
}

export interface BulkGrantAuthorizationWorkspaceRoleAccessUseCaseDependencies {
  readonly mutationService: AuthorizationPolicyMutationService;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly persistencePorts: AuthorizationPolicyPersistencePorts;
  readonly idGenerator?: AuthorizationUseCaseIdGenerator;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class BulkGrantAuthorizationWorkspaceRoleAccessUseCase {
  private readonly idGenerator: AuthorizationUseCaseIdGenerator;
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: BulkGrantAuthorizationWorkspaceRoleAccessUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultAuthorizationUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: BulkGrantAuthorizationWorkspaceRoleAccessUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<BulkGrantAuthorizationWorkspaceRoleAccessUseCaseResult>> {
    let parsed: ReturnType<typeof parseAuthorizationBulkWorkspaceRoleSharingGrantRequest>;
    try {
      parsed = parseAuthorizationBulkWorkspaceRoleSharingGrantRequest(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error) ?? {
        ok: false,
        error: {
          code: AuthorizationAdministrationErrorCodes.invalidRequest,
          message: "Bulk workspace-role sharing grant request is invalid.",
        },
      };
    }

    const uniquePermissionKeys = Object.freeze([...new Set(parsed.permissionKeys)]);
    const results: BulkGrantAuthorizationWorkspaceRoleAccessResultItem[] = [];
    const nowIso = this.clock.now().toISOString();

    for (const resource of dedupeResourcesInOrder(parsed.resources)) {
      const requiredPermissionKey = `${resource.resourceFamily}.share`;
      const actorDecision = await assertActorAuthorizedForResourcePermission({
        decisionEvaluator: this.dependencies.decisionEvaluator,
        actor: {
          actorUserIdentityId: parsed.actorUserIdentityId,
          activeWorkspaceId: parsed.workspaceId,
        },
        resource,
        requiredPermissionKey,
      });

      if (!actorDecision.isAllowed) {
        results.push(Object.freeze({
          resource,
          status: "failed",
          error: Object.freeze({
            code: AuthorizationAdministrationErrorCodes.forbidden,
            message: "Actor is not authorized to grant explicit sharing access for this resource.",
            details: Object.freeze({
              reasonCode: actorDecision.reasonCode,
              requiredPermissionKey,
            }),
          }),
        }));
        continue;
      }

      const metadata = await this.dependencies.persistencePorts.resourcePolicyMetadataPersistenceRepository.findResourcePolicyMetadata(resource);
      if (!metadata || metadata.deletedAt) {
        results.push(Object.freeze({
          resource,
          status: "failed",
          error: Object.freeze({
            code: AuthorizationAdministrationErrorCodes.notFound,
            message: "Resource policy metadata was not found for sharing grant mutation.",
          }),
        }));
        continue;
      }

      if (metadata.workspaceId !== parsed.workspaceId) {
        results.push(Object.freeze({
          resource,
          status: "failed",
          error: Object.freeze({
            code: AuthorizationAdministrationErrorCodes.conflict,
            message: "Requested workspaceId does not match persisted resource workspace.",
          }),
        }));
        continue;
      }

      if (metadata.ownershipScope === ResourceOwnershipScopes.userPrivate) {
        results.push(Object.freeze({
          resource,
          status: "failed",
          error: Object.freeze({
            code: AuthorizationAdministrationErrorCodes.conflict,
            message: "User-private ownership cannot be granted workspace-role sharing access.",
          }),
        }));
        continue;
      }

      if (metadata.visibility !== ResourceVisibilities.shared && metadata.visibility !== ResourceVisibilities.published) {
        results.push(Object.freeze({
          resource,
          status: "failed",
          error: Object.freeze({
            code: AuthorizationAdministrationErrorCodes.conflict,
            message: "Explicit workspace-role sharing grants require shared or published visibility.",
            details: Object.freeze({
              visibility: metadata.visibility,
            }),
          }),
        }));
        continue;
      }

      const existingGrants = await this.dependencies.persistencePorts.sharingGrantPersistenceRepository.listSharingGrants({
        resource,
        includeRevoked: false,
      });
      const existingGrant = existingGrants.find((candidate) => (
        candidate.subject.kind === "workspace-role"
        && candidate.subject.workspaceId === parsed.workspaceId
        && candidate.subject.roleKey === parsed.roleKey
      ));

      const grantId = existingGrant?.id
        ?? this.idGenerator.nextId(AuthorizationUseCaseIdNamespaces.sharingGrant);
      const mutation = await this.dependencies.mutationService.upsertSharingGrant({
        record: {
          id: grantId,
          resourceFamily: resource.resourceFamily,
          resourceType: resource.resourceType,
          resourceId: resource.resourceId,
          workspaceId: metadata.workspaceId,
          subject: {
            kind: "workspace-role",
            workspaceId: parsed.workspaceId,
            roleKey: parsed.roleKey,
          },
          permissionKeys: uniquePermissionKeys,
          grantedAt: existingGrant?.grantedAt ?? nowIso,
          grantedByUserIdentityId: existingGrant?.grantedByUserIdentityId ?? parsed.actorUserIdentityId,
          expiresAt: existingGrant?.expiresAt,
          revokedAt: undefined,
          revokedByUserIdentityId: undefined,
          createdAt: existingGrant?.createdAt ?? nowIso,
          createdBy: existingGrant?.createdBy ?? parsed.actorUserIdentityId,
          lastModifiedAt: nowIso,
          lastModifiedBy: parsed.actorUserIdentityId,
          revision: existingGrant?.revision ?? 0,
        },
        mutation: createAuthorizationMutationEnvelope({
          actorUserIdentityId: parsed.actorUserIdentityId,
          operationPrefix: "bulk-grant-workspace-role-sharing",
          idGenerator: this.idGenerator,
          clock: this.clock,
          reason: input.reason,
          correlationId: input.correlationId,
          metadata: {
            ...input.metadata,
            bulkWorkspaceId: parsed.workspaceId,
            bulkRoleKey: parsed.roleKey,
            bulkResourceLookupKey: toAuthorizationResourceLookupKey(resource),
          },
        }),
      });

      const status = !mutation.changed
        ? "unchanged"
        : existingGrant
          ? "updated"
          : "created";

      results.push(Object.freeze({
        resource,
        status,
        grantId,
        changed: mutation.changed,
        mutation,
      }));
    }

    const succeededResources = results.filter((item) => item.status !== "failed").length;
    const failedResources = results.length - succeededResources;
    return {
      ok: true,
      value: Object.freeze({
        workspaceId: parsed.workspaceId,
        roleKey: parsed.roleKey,
        permissionKeys: uniquePermissionKeys,
        totalResources: results.length,
        succeededResources,
        failedResources,
        results: Object.freeze(results),
      }),
    };
  }
}

function dedupeResourcesInOrder(
  resources: ReadonlyArray<{
    readonly resourceFamily: AuthorizationResourceFamily;
    readonly resourceType: string;
    readonly resourceId: string;
  }>,
): ReadonlyArray<{
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}> {
  const seen = new Set<string>();
  const deduped: Array<{
    readonly resourceFamily: AuthorizationResourceFamily;
    readonly resourceType: string;
    readonly resourceId: string;
  }> = [];

  for (const resource of resources) {
    const key = toAuthorizationResourceLookupKey(resource);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(resource);
  }

  return Object.freeze(deduped);
}
