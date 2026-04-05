import type { AuthorizationSharingGrantPersistenceRecord, AuthorizationPersistenceMutationResult } from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationSharingGrantChangeRequest, type AuthorizationSharingGrantChangeRequest } from "../../../shared/schemas/authorization/AuthorizationSchemaContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService, type AuthorizationPolicyMutationServiceClock } from "./AuthorizationPolicyMutationService";
import {
  assertActorAuthorizedForResourcePermission,
  AuthorizationAdministrationErrorCodes,
  AuthorizationUseCaseIdNamespaces,
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
  isBroadShareTarget,
} from "./AuthorizationHighRiskChangeSafeguards";

export interface GrantAuthorizationSharingAccessUseCaseInput {
  readonly request: unknown;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GrantAuthorizationSharingAccessUseCaseDependencies {
  readonly mutationService: AuthorizationPolicyMutationService;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly persistencePorts: AuthorizationPolicyPersistencePorts;
  readonly idGenerator?: AuthorizationUseCaseIdGenerator;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class GrantAuthorizationSharingAccessUseCase {
  private readonly idGenerator: AuthorizationUseCaseIdGenerator;
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: GrantAuthorizationSharingAccessUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultAuthorizationUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: GrantAuthorizationSharingAccessUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>>> {
    let parsed: ReturnType<typeof parseAuthorizationSharingGrantChangeRequest>;
    try {
      parsed = parseAuthorizationSharingGrantChangeRequest(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Authorization sharing grant request is invalid.");
    }

    if (parsed.operation !== "upsert") {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.invalidRequest,
        "GrantAuthorizationSharingAccessUseCase requires operation='upsert'.",
      );
    }

    const actorDecision = await assertActorAuthorizedForResourcePermission({
      decisionEvaluator: this.dependencies.decisionEvaluator,
      actor: {
        actorUserIdentityId: parsed.actorUserIdentityId,
        activeWorkspaceId: parsed.workspaceId,
      },
      resource: parsed.resource,
      requiredPermissionKey: `${parsed.resource.resourceFamily}.share`,
    });

    if (!actorDecision.isAllowed) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.forbidden,
        "Actor is not authorized to grant explicit sharing access for this resource.",
        {
          reasonCode: actorDecision.reasonCode,
          requiredPermissionKey: `${parsed.resource.resourceFamily}.share`,
        },
      );
    }

    const metadata = await this.dependencies.persistencePorts.resourcePolicyMetadataPersistenceRepository.findResourcePolicyMetadata(parsed.resource);
    if (!metadata || metadata.deletedAt) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.notFound,
        "Resource policy metadata was not found for sharing grant mutation.",
      );
    }

    if (metadata.visibility !== parsed.visibility) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "Requested visibility does not match persisted resource visibility.",
        {
          expectedVisibility: metadata.visibility,
          providedVisibility: parsed.visibility,
        },
      );
    }

    if (parsed.workspaceId && metadata.workspaceId !== parsed.workspaceId) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "Requested workspaceId does not match persisted resource workspace.",
      );
    }

    const existing = await this.dependencies.persistencePorts.sharingGrantPersistenceRepository.findSharingGrantById(parsed.grant.id);
    if (existing && (
      existing.resourceFamily !== parsed.resource.resourceFamily
      || existing.resourceType !== parsed.resource.resourceType
      || existing.resourceId !== parsed.resource.resourceId
    )) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "Sharing grant id is already used by a different resource.",
      );
    }

    const addedPermissionKeys = deriveAddedPermissionKeys(existing?.permissionKeys, parsed.grant.permissionKeys);
    const riskCodes = new Set<AuthorizationHighRiskChangeCode>();
    if (isBroadShareTarget(parsed.grant.target)) {
      const isNewGrant = !existing || !!existing.revokedAt;
      const broadensSubjectReach = existing ? !isBroadPersistenceSubject(existing.subject) : false;
      if (isNewGrant || broadensSubjectReach || addedPermissionKeys.length > 0) {
        riskCodes.add(AuthorizationHighRiskChangeCodes.broadSubjectShare);
      }
    }
    if (containsSharePermissionEscalation(addedPermissionKeys)) {
      riskCodes.add(AuthorizationHighRiskChangeCodes.sharePermissionEscalation);
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
    const result = await this.dependencies.mutationService.upsertSharingGrant({
      record: {
        id: parsed.grant.id,
        resourceFamily: parsed.resource.resourceFamily,
        resourceType: parsed.resource.resourceType,
        resourceId: parsed.resource.resourceId,
        workspaceId: metadata.workspaceId,
        subject: toPersistenceSubject(parsed.grant.target),
        permissionKeys: Object.freeze([...new Set(parsed.grant.permissionKeys)]),
        grantedAt: existing?.grantedAt ?? nowIso,
        grantedByUserIdentityId: existing?.grantedByUserIdentityId ?? parsed.actorUserIdentityId,
        expiresAt: existing?.expiresAt,
        revokedAt: undefined,
        revokedByUserIdentityId: undefined,
        createdAt: existing?.createdAt ?? nowIso,
        createdBy: existing?.createdBy ?? parsed.actorUserIdentityId,
        lastModifiedAt: nowIso,
        lastModifiedBy: parsed.actorUserIdentityId,
        revision: existing?.revision ?? 0,
      },
      mutation: createAuthorizationMutationEnvelope({
        actorUserIdentityId: parsed.actorUserIdentityId,
        operationPrefix: "grant-sharing",
        idGenerator: this.idGenerator,
        clock: this.clock,
        expectedRevision: input.expectedRevision,
        reason: input.reason,
        correlationId: input.correlationId,
        metadata: input.metadata,
      }),
    });

    return {
      ok: true,
      value: result,
    };
  }
}

function toPersistenceSubject(subject: Extract<AuthorizationSharingGrantChangeRequest, { operation: "upsert" }>["grant"]["target"]) {
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
