import type { AuthorizationSharingGrantPersistenceRecord, AuthorizationPersistenceMutationResult } from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationSharingGrantChangeRequest } from "@shared/schemas/authorization/AuthorizationSchemaContracts";
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

export interface RevokeAuthorizationSharingAccessUseCaseInput {
  readonly request: unknown;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RevokeAuthorizationSharingAccessUseCaseDependencies {
  readonly mutationService: AuthorizationPolicyMutationService;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly persistencePorts: AuthorizationPolicyPersistencePorts;
  readonly idGenerator?: AuthorizationUseCaseIdGenerator;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class RevokeAuthorizationSharingAccessUseCase {
  private readonly idGenerator: AuthorizationUseCaseIdGenerator;
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: RevokeAuthorizationSharingAccessUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultAuthorizationUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: RevokeAuthorizationSharingAccessUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<AuthorizationPersistenceMutationResult<AuthorizationSharingGrantPersistenceRecord>>> {
    let parsed: ReturnType<typeof parseAuthorizationSharingGrantChangeRequest>;
    try {
      parsed = parseAuthorizationSharingGrantChangeRequest(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Authorization sharing revocation request is invalid.");
    }

    if (parsed.operation !== "revoke") {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.invalidRequest,
        "RevokeAuthorizationSharingAccessUseCase requires operation='revoke'.",
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
        "Actor is not authorized to revoke explicit sharing access for this resource.",
        {
          reasonCode: actorDecision.reasonCode,
          requiredPermissionKey: `${parsed.resource.resourceFamily}.share`,
        },
      );
    }

    const existing = await this.dependencies.persistencePorts.sharingGrantPersistenceRepository.findSharingGrantById(parsed.grantId);
    if (!existing) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.notFound,
        `Sharing grant '${parsed.grantId}' was not found.`,
      );
    }

    if (
      existing.resourceFamily !== parsed.resource.resourceFamily
      || existing.resourceType !== parsed.resource.resourceType
      || existing.resourceId !== parsed.resource.resourceId
    ) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "Sharing grant does not belong to the requested resource.",
      );
    }

    const result = await this.dependencies.mutationService.revokeSharingGrant({
      sharingGrantId: parsed.grantId,
      revokedByUserIdentityId: parsed.actorUserIdentityId,
      mutation: createAuthorizationMutationEnvelope({
        actorUserIdentityId: parsed.actorUserIdentityId,
        operationPrefix: "revoke-sharing",
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

