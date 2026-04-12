import { RoleAssignmentScopes, RoleAssignmentStatuses } from "@domain/authorization/AuthorizationDomain";
import type { AuthorizationPersistenceMutationResult, AuthorizationRoleAssignmentPersistenceRecord } from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { parseAuthorizationRoleAssignmentRequest } from "@shared/schemas/authorization/AuthorizationSchemaContracts";
import type { AuthorizationPolicyPersistencePorts } from "../ports/AuthorizationPolicyPersistencePorts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../ports/IAuthorizationPolicyDecisionEvaluator";
import { AuthorizationPolicyMutationService, type AuthorizationPolicyMutationServiceClock } from "./AuthorizationPolicyMutationService";
import {
  assertActorAuthorizedForWorkspaceCapability,
  AuthorizationAdministrationErrorCodes,
  AuthorizationUseCaseIdNamespaces,
  type AuthorizationAdministrationOutcome,
  type AuthorizationUseCaseIdGenerator,
  DefaultAuthorizationUseCaseIdGenerator,
  createAuthorizationMutationEnvelope,
  mapAuthorizationSchemaValidationError,
  toAuthorizationFailure,
} from "./AuthorizationAdministrationUseCaseShared";

export interface AssignAuthorizationRoleUseCaseInput {
  readonly request: unknown;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AssignAuthorizationRoleUseCaseDependencies {
  readonly mutationService: AuthorizationPolicyMutationService;
  readonly decisionEvaluator: IAuthorizationPolicyDecisionEvaluator;
  readonly persistencePorts: AuthorizationPolicyPersistencePorts;
  readonly idGenerator?: AuthorizationUseCaseIdGenerator;
  readonly clock?: AuthorizationPolicyMutationServiceClock;
}

export class AssignAuthorizationRoleUseCase {
  private readonly idGenerator: AuthorizationUseCaseIdGenerator;
  private readonly clock: AuthorizationPolicyMutationServiceClock;

  public constructor(private readonly dependencies: AssignAuthorizationRoleUseCaseDependencies) {
    this.idGenerator = dependencies.idGenerator ?? new DefaultAuthorizationUseCaseIdGenerator();
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
  }

  public async execute(
    input: AssignAuthorizationRoleUseCaseInput,
  ): Promise<AuthorizationAdministrationOutcome<AuthorizationPersistenceMutationResult<AuthorizationRoleAssignmentPersistenceRecord>>> {
    let parsed: ReturnType<typeof parseAuthorizationRoleAssignmentRequest>;
    try {
      parsed = parseAuthorizationRoleAssignmentRequest(input.request);
    } catch (error) {
      return mapAuthorizationSchemaValidationError(error)
        ?? toAuthorizationFailure(AuthorizationAdministrationErrorCodes.invalidRequest, "Authorization role assignment request is invalid.");
    }

    if (parsed.operation !== "assign") {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.invalidRequest,
        "AssignAuthorizationRoleUseCase requires operation='assign'.",
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
        "Actor is not authorized to assign workspace roles.",
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

    if (existing.length > 0) {
      return toAuthorizationFailure(
        AuthorizationAdministrationErrorCodes.conflict,
        `Target user '${parsed.targetUserIdentityId}' already has active role '${parsed.roleKey}' in workspace '${parsed.workspaceId}'.`,
        {
          roleAssignmentId: existing[0]?.id,
        },
      );
    }

    const nowIso = this.clock.now().toISOString();
    const result = await this.dependencies.mutationService.upsertRoleAssignment({
      record: {
        id: this.idGenerator.nextId(AuthorizationUseCaseIdNamespaces.roleAssignment),
        actorUserIdentityId: parsed.targetUserIdentityId,
        roleKey: parsed.roleKey,
        scope: RoleAssignmentScopes.workspace,
        workspaceId: parsed.workspaceId,
        status: RoleAssignmentStatuses.active,
        assignedAt: nowIso,
        assignedByUserIdentityId: parsed.actorUserIdentityId,
        createdAt: nowIso,
        createdBy: parsed.actorUserIdentityId,
        lastModifiedAt: nowIso,
        lastModifiedBy: parsed.actorUserIdentityId,
        revision: 0,
      },
      mutation: createAuthorizationMutationEnvelope({
        actorUserIdentityId: parsed.actorUserIdentityId,
        operationPrefix: "assign-role",
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

