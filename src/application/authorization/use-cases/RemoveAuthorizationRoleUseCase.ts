import { RoleAssignmentScopes, RoleAssignmentStatuses } from "@domain/authorization/AuthorizationDomain";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import type { AuthorizationPersistenceMutationResult, AuthorizationRoleAssignmentPersistenceRecord } from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationRoleAssignmentRequest } from "@shared/schemas/authorization/AuthorizationSchemaContracts";
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
import { AuthorizationHighRiskChangeCodes } from "./AuthorizationHighRiskChangeSafeguards";

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

    if (parsed.roleKey === WorkspaceAuthorizationRoleKeys.admin) {
      const continuity = await this.assertWorkspaceAdministrativeContinuity(parsed.workspaceId, parsed.targetUserIdentityId);
      if (!continuity.ok) {
        return continuity.outcome;
      }
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

  private async assertWorkspaceAdministrativeContinuity(
    workspaceId: string,
    targetUserIdentityId: string,
  ): Promise<{ readonly ok: true } | { readonly ok: false; readonly outcome: AuthorizationAdministrationOutcome<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>> }> {
    const activeAssignments = await this.dependencies.persistencePorts.roleAssignmentPersistenceRepository.listRoleAssignments({
      workspaceId,
      scope: RoleAssignmentScopes.workspace,
      statuses: [RoleAssignmentStatuses.active],
      includeRevoked: false,
    });

    const activeAdministrativeUsers = new Set<string>();
    for (const roleAssignment of activeAssignments) {
      if (
        roleAssignment.roleKey === WorkspaceAuthorizationRoleKeys.owner
        || roleAssignment.roleKey === WorkspaceAuthorizationRoleKeys.admin
      ) {
        activeAdministrativeUsers.add(roleAssignment.actorUserIdentityId);
      }
    }

    const targetHasOwnerRole = activeAssignments.some((roleAssignment) => (
      roleAssignment.actorUserIdentityId === targetUserIdentityId
      && roleAssignment.roleKey === WorkspaceAuthorizationRoleKeys.owner
    ));
    if (!targetHasOwnerRole) {
      activeAdministrativeUsers.delete(targetUserIdentityId);
    }

    if (activeAdministrativeUsers.size > 0) {
      return { ok: true };
    }

    return {
      ok: false,
      outcome: toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        "Workspace must retain at least one active owner or admin role assignment. Assign a replacement administrator before this change.",
        {
          reasonCode: AuthorizationHighRiskChangeCodes.lastWorkspaceAdministratorRemoval,
          riskCodes: Object.freeze([AuthorizationHighRiskChangeCodes.lastWorkspaceAdministratorRemoval]),
        },
      ),
    };
  }
}

