import { RoleAssignmentScopes, RoleAssignmentStatuses } from "../../../domain/authorization/AuthorizationDomain";
import type { AuthorizationPersistenceMutationResult, AuthorizationRoleAssignmentPersistenceRecord } from "../../../shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationRoleAssignmentRequest } from "../../../shared/schemas/authorization/AuthorizationSchemaContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService, type AuthorizationPolicyMutationServiceClock } from "./AuthorizationPolicyMutationService";
import {
  assertActorAuthorizedForWorkspaceCapability,
  AuthorizationAdministrationErrorCodes,
  type AuthorizationAdministrationOutcome,
  type AuthorizationUseCaseIdGenerator,
  DefaultAuthorizationUseCaseIdGenerator,
  createAuthorizationMutationEnvelope,
  mapAuthorizationSchemaValidationError,
  toAuthorizationFailure,
} from "./AuthorizationAdministrationUseCaseShared";

export interface RemoveAuthorizationRoleUseCaseInput {
  readonly request: unknown;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RemoveAuthorizationRoleUseCaseDependencies {
  readonly mutationService: AuthorizationPolicyMutationService;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly persistencePorts: AuthorizationPolicyPersistencePorts;
  readonly idGenerator?: AuthorizationUseCaseIdGenerator;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class RemoveAuthorizationRoleUseCase {
  private readonly idGenerator: AuthorizationUseCaseIdGenerator;
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: RemoveAuthorizationRoleUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultAuthorizationUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: RemoveAuthorizationRoleUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>>> {
    let parsed: ReturnType<typeof parseAuthorizationRoleAssignmentRequest>;
    try {
      parsed = parseAuthorizationRoleAssignmentRequest(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Authorization role removal request is invalid.");
    }

    if (parsed.operation !== "revoke") {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.invalidRequest,
        "RemoveAuthorizationRoleUseCase requires operation='revoke'.",
      );
    }

    const actorDecision = await assertActorAuthorizedForWorkspaceCapability({
      decisionEvaluator: this.dependencies.decisionEvaluator,
      actorUserIdentityId: parsed.actorUserIdentityId,
      workspaceId: parsed.workspaceId,
      requiredPermissionKey: "system.manage",
    });

    if (!actorDecision.isAllowed) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.forbidden,
        "Actor is not authorized to remove workspace roles.",
        {
          reasonCode: actorDecision.reasonCode,
          requiredPermissionKey: "system.manage",
        },
      );
    }

    const existing = await this.dependencies.persistencePorts.roleAssignmentPersistenceRepository.listRoleAssignments({
      workspaceId: parsed.workspaceId,
      actorUserIdentityId: parsed.targetUserIdentityId,
      roleKey: parsed.roleKey,
      scope: RoleAssignmentScopes.workspace,
      statuses: [RoleAssignmentStatuses.active],
      includeRevoked: false,
      limit: 1,
    });

    const assignment = existing[0];
    if (!assignment) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.notFound,
        `Target user '${parsed.targetUserIdentityId}' does not have active role '${parsed.roleKey}' in workspace '${parsed.workspaceId}'.`,
      );
    }

    const result = await this.dependencies.mutationService.revokeRoleAssignment({
      roleAssignmentId: assignment.id,
      revokedByUserIdentityId: parsed.actorUserIdentityId,
      mutation: createAuthorizationMutationEnvelope({
        actorUserIdentityId: parsed.actorUserIdentityId,
        operationPrefix: "remove-role",
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
