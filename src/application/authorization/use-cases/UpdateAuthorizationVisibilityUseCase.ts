import { ResourceOwnershipScopes, ResourceVisibilities } from "../../../domain/authorization/AuthorizationDomain";
import type {
  AuthorizationPersistenceMutationResult,
  AuthorizationResourcePolicyMetadataPersistenceRecord,
  AuthorizationSharingGrantPersistenceRecord,
} from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationVisibilityUpdateRequest } from "../../../shared/schemas/authorization/AuthorizationSchemaContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService, type AuthorizationPolicyMutationServiceClock } from "./AuthorizationPolicyMutationService";
import {
  assertActorAuthorizedForResourcePermission,
  AuthorizationAdministrationErrorCodes,
  type AuthorizationAdministrationOutcome,
  type AuthorizationUseCaseIdGenerator,
  DefaultAuthorizationUseCaseIdGenerator,
  createAuthorizationMutationEnvelope,
  mapAuthorizationSchemaValidationError,
  toAuthorizationFailure,
} from "./AuthorizationAdministrationUseCaseShared";
import {
  AuthorizationHighRiskChangeCodes,
  type AuthorizationHighRiskChangeCode,
  assertHighRiskChangesConfirmed,
  containsSharePermissionEscalation,
  deriveAddedPermissionKeys,
  deriveVisibilityExposureRank,
  isBroadShareTarget,
} from "./AuthorizationHighRiskChangeSafeguards";

export interface UpdateAuthorizationVisibilityUseCaseInput {
  readonly request: unknown;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateAuthorizationVisibilityUseCaseResult {
  readonly metadataMutation: AuthorizationPersistenceMutationResult<AuthorizationResourcePolicyMetadataPersistenceRecord>;
  readonly sharingGrantMutations: ReadonlyArray<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>>;
}

export interface UpdateAuthorizationVisibilityUseCaseDependencies {
  readonly mutationService: AuthorizationPolicyMutationService;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly persistencePorts: AuthorizationPolicyPersistencePorts;
  readonly idGenerator?: AuthorizationUseCaseIdGenerator;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class UpdateAuthorizationVisibilityUseCase {
  private readonly idGenerator: AuthorizationUseCaseIdGenerator;
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: UpdateAuthorizationVisibilityUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultAuthorizationUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: UpdateAuthorizationVisibilityUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<UpdateAuthorizationVisibilityUseCaseResult>> {
    let parsed: ReturnType<typeof parseAuthorizationVisibilityUpdateRequest>;
    try {
      parsed = parseAuthorizationVisibilityUpdateRequest(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Authorization visibility update request is invalid.");
    }

    const actorDecision = await assertActorAuthorizedForResourcePermission({
      decisionEvaluator: this.dependencies.decisionEvaluator,
      actor: {
        actorUserIdentityId: parsed.actorUserIdentityId,
        activeWorkspaceId: parsed.workspaceId,
      },
      resource: parsed.subject,
      requiredPermissionKey: `${parsed.subject.resourceFamily}.manage`,
    });

    if (!actorDecision.isAllowed) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.forbidden,
        "Actor is not authorized to update resource visibility policy.",
        {
          reasonCode: actorDecision.reasonCode,
          requiredPermissionKey: `${parsed.subject.resourceFamily}.manage`,
        },
      );
    }

    const existingMetadata = await this.dependencies.persistencePorts.resourcePolicyMetadataPersistenceRepository.findResourcePolicyMetadata(parsed.subject);
    if (!existingMetadata || existingMetadata.deletedAt) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.notFound,
        "Resource policy metadata was not found.",
      );
    }

    if (parsed.workspaceId && existingMetadata.workspaceId !== parsed.workspaceId) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "Requested workspaceId does not match persisted resource workspace.",
      );
    }

    if (existingMetadata.ownershipScope === ResourceOwnershipScopes.userPrivate && parsed.visibility !== ResourceVisibilities.private) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "User-private ownership can only use private visibility.",
      );
    }

    const existingGrants = await this.dependencies.persistencePorts.sharingGrantPersistenceRepository.listSharingGrants({
      resource: parsed.subject,
      includeRevoked: false,
    });
    const existingGrantById = new Map(existingGrants.map((grant) => [grant.id, grant]));
    const riskCodes = new Set<AuthorizationHighRiskChangeCode>();

    if (deriveVisibilityExposureRank(parsed.visibility) > deriveVisibilityExposureRank(existingMetadata.visibility)) {
      riskCodes.add(AuthorizationHighRiskChangeCodes.visibilityBroadened);
    }

    if (existingMetadata.visibility !== ResourceVisibilities.published && parsed.visibility === ResourceVisibilities.published) {
      riskCodes.add(AuthorizationHighRiskChangeCodes.resourcePublished);
    }

    if (!existingMetadata.allowResharing && parsed.allowResharing) {
      riskCodes.add(AuthorizationHighRiskChangeCodes.resharingEnabled);
    }

    for (const grant of parsed.sharingGrants) {
      const previousGrant = existingGrantById.get(grant.id);
      const addedPermissionKeys = deriveAddedPermissionKeys(previousGrant?.permissionKeys, grant.permissionKeys);
      const broadensSubjectReach = previousGrant ? !isBroadPersistenceSubject(previousGrant.subject) : false;
      if (isBroadShareTarget(grant.target) && (!previousGrant || broadensSubjectReach || addedPermissionKeys.length > 0)) {
        riskCodes.add(AuthorizationHighRiskChangeCodes.broadSubjectShare);
      }
      if (containsSharePermissionEscalation(addedPermissionKeys)) {
        riskCodes.add(AuthorizationHighRiskChangeCodes.sharePermissionEscalation);
      }
    }

    const unconfirmedHighRisk = assertHighRiskChangesConfirmed({
      actorUserIdentityId: parsed.actorUserIdentityId,
      riskCodes: [...riskCodes],
      metadata: input.metadata,
    });
    if (unconfirmedHighRisk) {
      return unconfirmedHighRisk;
    }

    const nowIso = this.clock.now().toISOString();
    const metadataMutation = await this.dependencies.mutationService.upsertResourcePolicyMetadata({
      record: {
        ...existingMetadata,
        workspaceId: existingMetadata.workspaceId ?? parsed.workspaceId,
        visibility: parsed.visibility,
        sharingPolicyMode: parsed.sharingPolicyMode,
        allowResharing: parsed.allowResharing,
        isPublishedCapable: parsed.isPublishedCapable,
        publishedAt: parsed.publishedAt,
        deletedAt: undefined,
        deletedByUserIdentityId: undefined,
        lastModifiedAt: nowIso,
        lastModifiedBy: parsed.actorUserIdentityId,
        revision: existingMetadata.revision,
      },
      mutation: createAuthorizationMutationEnvelope({
        actorUserIdentityId: parsed.actorUserIdentityId,
        operationPrefix: "update-visibility",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: input.expectedRevision,
        reason: input.reason,
        correlationId: input.correlationId,
        metadata: input.metadata,
      }),
    });

    const mutations: AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>[] = [];
    const targetGrantIds = new Set(parsed.sharingGrants.map((grant) => grant.id));

    for (const existingGrant of existingGrants) {
      if (targetGrantIds.has(existingGrant.id)) {
        continue;
      }

      mutations.push(await this.dependencies.mutationService.revokeSharingGrant({
        sharingGrantId: existingGrant.id,
        revokedByUserIdentityId: parsed.actorUserIdentityId,
        mutation: createAuthorizationMutationEnvelope({
          actorUserIdentityId: parsed.actorUserIdentityId,
          operationPrefix: "update-visibility-revoke-sharing",
          idGenerator: this.idGenerator,
          clock: this.clock,
          reason: input.reason,
          correlationId: input.correlationId,
          metadata: input.metadata,
        }),
      }));
    }

    for (const grant of parsed.sharingGrants) {
      const existingGrant = await this.dependencies.persistencePorts.sharingGrantPersistenceRepository.findSharingGrantById(grant.id);
      const upsertResult = await this.dependencies.mutationService.upsertSharingGrant({
        record: {
          id: grant.id,
          resourceFamily: parsed.subject.resourceFamily,
          resourceType: parsed.subject.resourceType,
          resourceId: parsed.subject.resourceId,
          workspaceId: existingMetadata.workspaceId ?? parsed.workspaceId,
          subject: toPersistenceSubject(grant.target),
          permissionKeys: Object.freeze([...new Set(grant.permissionKeys)]),
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
          operationPrefix: "update-visibility-upsert-sharing",
          idGenerator: this.idGenerator,
          clock: this.clock,
          reason: input.reason,
          correlationId: input.correlationId,
          metadata: input.metadata,
        }),
      });
      mutations.push(upsertResult);
    }

    return {
      ok: true,
      value: Object.freeze({
        metadataMutation,
        sharingGrantMutations: Object.freeze(mutations),
      }),
    };
  }
}

function toPersistenceSubject(subject: ReturnType<typeof parseAuthorizationVisibilityUpdateRequest>["sharingGrants"][number]["target"]) {
  if (subject.kind === "user") {
    return {
      kind: "user" as const,
      userIdentityId: subject.userId,
    };
  }

  if (subject.kind === "workspace") {
    return {
      kind: "workspace" as const,
      workspaceId: subject.workspaceId,
    };
  }

  if (subject.kind === "workspace-role") {
    return {
      kind: "workspace-role" as const,
      workspaceId: subject.workspaceId,
      roleKey: subject.roleKey,
    };
  }

  return {
    kind: "public" as const,
  };
}

function isBroadPersistenceSubject(subject: {
  readonly kind: "user" | "workspace-role" | "workspace" | "public";
  readonly roleKey?: string;
}): boolean {
  if (subject.kind === "workspace" || subject.kind === "public") {
    return true;
  }

  if (subject.kind === "workspace-role") {
    return isBroadShareTarget({
      kind: "workspace-role",
      roleKey: subject.roleKey,
    });
  }

  return false;
}
