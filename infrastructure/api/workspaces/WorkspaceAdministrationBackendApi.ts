import type { Workspace, WorkspaceRole } from "../../src/domain/workspaces/WorkspaceDomain";
import { WorkspaceRoleAssignmentStatuses, WorkspaceRoles } from "../../src/domain/workspaces/WorkspaceDomain";
import {
  CreateWorkspaceUseCase,
  type WorkspaceCreationErrorCode,
} from "../../src/application/workspaces/use-cases/CreateWorkspaceUseCase";
import {
  UpdateWorkspaceUseCase,
  type WorkspaceUpdateErrorCode,
} from "../../src/application/workspaces/use-cases/UpdateWorkspaceUseCase";
import {
  TransitionWorkspaceLifecycleUseCase,
  type WorkspaceLifecycleTransitionErrorCode,
} from "../../src/application/workspaces/use-cases/TransitionWorkspaceLifecycleUseCase";
import {
  AddWorkspaceMemberUseCase,
  type WorkspaceMembershipAdditionErrorCode,
} from "../../src/application/workspaces/use-cases/AddWorkspaceMemberUseCase";
import {
  ChangeWorkspaceMembershipStatusUseCase,
  type WorkspaceMembershipStatusChangeErrorCode,
} from "../../src/application/workspaces/use-cases/ChangeWorkspaceMembershipStatusUseCase";
import {
  RemoveWorkspaceMemberUseCase,
  type WorkspaceMembershipRemovalErrorCode,
} from "../../src/application/workspaces/use-cases/RemoveWorkspaceMemberUseCase";
import {
  AssignWorkspaceRoleUseCase,
  type WorkspaceRoleAssignmentErrorCode,
} from "../../src/application/workspaces/use-cases/AssignWorkspaceRoleUseCase";
import {
  ReassignWorkspaceRoleUseCase,
  type WorkspaceRoleReassignmentErrorCode,
} from "../../src/application/workspaces/use-cases/ReassignWorkspaceRoleUseCase";
import {
  RevokeWorkspaceRoleUseCase,
  type WorkspaceRoleRevocationErrorCode,
} from "../../src/application/workspaces/use-cases/RevokeWorkspaceRoleUseCase";
import {
  ResolveWorkspaceInvitationLifecycleUseCase,
  WorkspaceInvitationLifecycleActions,
  type WorkspaceInvitationLifecycleErrorCode,
} from "../../src/application/workspaces/use-cases/ResolveWorkspaceInvitationLifecycleUseCase";
import {
  WorkspaceAdministrationQueryService,
  type WorkspaceAdministrationQueryErrorCode,
  type WorkspaceAdministrativeActorAccessSummary,
  type WorkspaceInvitationItemDto,
  type WorkspaceInvitationStatusSummary,
  type WorkspaceMembershipItemDto,
  type WorkspaceMembershipStatusSummary,
  type WorkspaceRoleAssignmentItemDto,
  type WorkspaceRoleSummary,
} from "../../src/application/workspaces/use-cases/WorkspaceAdministrationQueryService";
import type { IWorkspaceAuthorizationReadRepository } from "../../src/application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IWorkspaceInvitationRepository } from "../../src/application/workspaces/ports/IWorkspaceInvitationRepository";
import type { IWorkspaceMembershipRepository } from "../../src/application/workspaces/ports/IWorkspaceMembershipRepository";
import type { IWorkspaceRepository } from "../../src/application/workspaces/ports/IWorkspaceRepository";
import type { IWorkspaceRoleAssignmentRepository } from "../../src/application/workspaces/ports/IWorkspaceRoleAssignmentRepository";
import {
  WorkspaceAdministrationApiErrorCodes,
  type AddWorkspaceAdministrationMemberApiRequest,
  type AddWorkspaceAdministrationMemberApiResponse,
  type AssignWorkspaceAdministrationRoleApiRequest,
  type AssignWorkspaceAdministrationRoleApiResponse,
  type CancelWorkspaceAdministrationInvitationApiRequest,
  type CancelWorkspaceAdministrationInvitationApiResponse,
  type ChangeWorkspaceAdministrationMemberStatusApiRequest,
  type ChangeWorkspaceAdministrationMemberStatusApiResponse,
  type CreateWorkspaceAdministrationApiRequest,
  type CreateWorkspaceAdministrationApiResponse,
  type ListWorkspaceAdministrationInvitationsApiRequest,
  type ListWorkspaceAdministrationInvitationsApiResponse,
  type ListWorkspaceAdministrationMembershipsApiRequest,
  type ListWorkspaceAdministrationMembershipsApiResponse,
  type ListWorkspaceAdministrationRoleAssignmentsApiRequest,
  type ListWorkspaceAdministrationRoleAssignmentsApiResponse,
  type ListWorkspaceAdministrationWorkspacesApiRequest,
  type ListWorkspaceAdministrationWorkspacesApiResponse,
  type ReadWorkspaceAdministrationViewApiRequest,
  type ReadWorkspaceAdministrationViewApiResponse,
  type ReassignWorkspaceAdministrationRoleApiRequest,
  type ReassignWorkspaceAdministrationRoleApiResponse,
  type RemoveWorkspaceAdministrationMemberApiRequest,
  type RemoveWorkspaceAdministrationMemberApiResponse,
  type RevokeWorkspaceAdministrationRoleApiRequest,
  type RevokeWorkspaceAdministrationRoleApiResponse,
  type TransitionWorkspaceAdministrationLifecycleApiRequest,
  type TransitionWorkspaceAdministrationLifecycleApiResponse,
  type UpdateWorkspaceAdministrationApiRequest,
  type UpdateWorkspaceAdministrationApiResponse,
  type WorkspaceAdminListItemApiRecord,
  type WorkspaceAdministrativeActorCapabilitiesApiRecord,
  type WorkspaceAdministrationApiError,
  type WorkspaceAdministrationApiResponse,
  type WorkspaceInvitationApiRecord,
  type WorkspaceMembershipApiRecord,
  type WorkspaceRoleAssignmentApiRecord,
} from "./sdk/PublicWorkspaceAdministrationApiContract";
import { AuthorizationPolicyEvaluationTargetKinds } from "../../src/application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "../../src/application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";

interface WorkspaceAdministrationBackendApiDependencies {
  readonly workspaceQueryService: WorkspaceAdministrationQueryService;
  readonly workspaceRepository: IWorkspaceRepository;
  readonly membershipRepository: IWorkspaceMembershipRepository;
  readonly roleAssignmentRepository: IWorkspaceRoleAssignmentRepository;
  readonly invitationRepository: IWorkspaceInvitationRepository;
  readonly authorizationReadRepository: IWorkspaceAuthorizationReadRepository;
  readonly createWorkspaceUseCase: CreateWorkspaceUseCase;
  readonly updateWorkspaceUseCase: UpdateWorkspaceUseCase;
  readonly transitionWorkspaceLifecycleUseCase: TransitionWorkspaceLifecycleUseCase;
  readonly addWorkspaceMemberUseCase: AddWorkspaceMemberUseCase;
  readonly changeWorkspaceMembershipStatusUseCase: ChangeWorkspaceMembershipStatusUseCase;
  readonly removeWorkspaceMemberUseCase: RemoveWorkspaceMemberUseCase;
  readonly assignWorkspaceRoleUseCase: AssignWorkspaceRoleUseCase;
  readonly reassignWorkspaceRoleUseCase: ReassignWorkspaceRoleUseCase;
  readonly revokeWorkspaceRoleUseCase: RevokeWorkspaceRoleUseCase;
  readonly resolveWorkspaceInvitationLifecycleUseCase: ResolveWorkspaceInvitationLifecycleUseCase;
  readonly authorizationPolicyDecisionEvaluator?: IAuthorizationPolicyDecisionEvaluator;
  readonly workspaceAdministrationCapabilityResourceType?: string;
  readonly clock?: {
    now(): Date;
  };
}

type WorkspaceAdministrativeActorAccessWithCapabilities =
  WorkspaceAdministrativeActorAccessSummary
  & Readonly<{
    capabilities: WorkspaceAdministrativeActorCapabilitiesApiRecord;
  }>;

export class WorkspaceAdministrationBackendApi {
  private readonly clock: { now(): Date };
  private readonly workspaceAdministrationCapabilityResourceType: string;

  public constructor(private readonly dependencies: WorkspaceAdministrationBackendApiDependencies) {
    this.clock = dependencies.clock ?? {
      now: () => new Date(),
    };
    this.workspaceAdministrationCapabilityResourceType = dependencies.workspaceAdministrationCapabilityResourceType?.trim()
      || "workspace-administration";
  }

  public async listWorkspaces(
    request: ListWorkspaceAdministrationWorkspacesApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationWorkspacesApiResponse>> {
    const outcome = await this.dependencies.workspaceQueryService.listWorkspaces({
      actorUserIdentityId: request.actorUserIdentityId,
      ownerUserIdentityId: request.ownerUserIdentityId,
      statuses: request.statuses,
      visibility: request.visibility,
      slugPrefix: request.slugPrefix,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return this.failedFromQuery(outcome.error.code, outcome.error.message);
    }

    const workspaces = await Promise.all(outcome.value.workspaces.map(async (workspace) => (
      toWorkspaceAdminListItem({
        ...workspace,
        actorAccess: await this.withActorAccessCapabilities(workspace.id, request.actorUserIdentityId, workspace.actorAccess),
      })
    )));

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        workspaces: Object.freeze(workspaces),
        pagination: outcome.value.pagination,
      }),
    });
  }

  public async readWorkspaceAdministrationView(
    request: ReadWorkspaceAdministrationViewApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ReadWorkspaceAdministrationViewApiResponse>> {
    const workspaceId = request.workspaceId.trim();
    if (!workspaceId) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const actorUserIdentityId = request.actorUserIdentityId.trim();
    if (!actorUserIdentityId) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const memberships = await this.listWorkspaceMemberships({
      workspaceId,
      actorUserIdentityId,
      limit: 1,
      offset: 0,
    });
    if (!memberships.ok || !memberships.data) {
      return this.failedFromApiError(memberships.error);
    }

    const invitations = await this.listWorkspaceInvitations({
      workspaceId,
      actorUserIdentityId,
      asOf: request.asOf,
      limit: 1,
      offset: 0,
    });
    if (!invitations.ok || !invitations.data) {
      return this.failedFromApiError(invitations.error);
    }

    const roles = await this.listWorkspaceRoleAssignments({
      workspaceId,
      actorUserIdentityId,
      limit: 1,
      offset: 0,
    });
    if (!roles.ok || !roles.data) {
      return this.failedFromApiError(roles.error);
    }

    const workspace = await this.dependencies.workspaceRepository.findWorkspaceById(workspaceId);
    if (!workspace) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.notFound, `Workspace '${workspaceId}' was not found.`);
    }

    const actorAccess = await this.getActorAccessSummary(workspace.id, actorUserIdentityId);

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        workspace: Object.freeze({
          workspaceId: workspace.id,
          slug: workspace.slug,
          displayName: workspace.displayName,
          description: workspace.description,
          status: workspace.status,
          ownerUserIdentityId: workspace.ownership.ownerUserId,
          visibility: workspace.ownership.visibility,
          createdAt: workspace.ownership.createdAt,
          lastModifiedAt: workspace.ownership.lastModifiedAt,
          membershipSummary: memberships.data.workspaceMembershipSummary,
          roleSummary: roles.data.workspaceRoleSummary,
          invitationSummary: invitations.data.workspaceInvitationSummary,
          actorAccess,
        }),
        membershipSummary: memberships.data.workspaceMembershipSummary,
        roleSummary: roles.data.workspaceRoleSummary,
        invitationSummary: invitations.data.workspaceInvitationSummary,
      }),
    });
  }

  public async listWorkspaceMemberships(
    request: ListWorkspaceAdministrationMembershipsApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationMembershipsApiResponse>> {
    const outcome = await this.dependencies.workspaceQueryService.listWorkspaceMemberships({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      userIdentityId: request.userIdentityId,
      statuses: request.statuses,
      invitationId: request.invitationId,
      invitedByUserId: request.invitedByUserIdentityId,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return this.failedFromQuery(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        memberships: Object.freeze(outcome.value.memberships.map((membership) => toWorkspaceMembership(membership))),
        pagination: outcome.value.pagination,
        workspaceMembershipSummary: outcome.value.workspaceMembershipSummary,
        workspaceRoleSummary: outcome.value.workspaceRoleSummary,
      }),
    });
  }

  public async listWorkspaceInvitations(
    request: ListWorkspaceAdministrationInvitationsApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationInvitationsApiResponse>> {
    const outcome = await this.dependencies.workspaceQueryService.listWorkspaceInvitations({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      invitedEmail: request.invitedEmail,
      invitedByUserId: request.invitedByUserIdentityId,
      statuses: request.statuses,
      activeOnly: request.activeOnly,
      expiresBefore: request.expiresBefore,
      expiresAfter: request.expiresAfter,
      asOf: request.asOf,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return this.failedFromQuery(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invitations: Object.freeze(outcome.value.invitations.map((invitation) => toWorkspaceInvitation(invitation))),
        pagination: outcome.value.pagination,
        workspaceInvitationSummary: outcome.value.workspaceInvitationSummary,
      }),
    });
  }

  public async listWorkspaceRoleAssignments(
    request: ListWorkspaceAdministrationRoleAssignmentsApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationRoleAssignmentsApiResponse>> {
    const outcome = await this.dependencies.workspaceQueryService.listWorkspaceRoleAssignments({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      userIdentityId: request.userIdentityId,
      roles: request.roles,
      statuses: request.statuses,
      limit: request.limit,
      offset: request.offset,
    });

    if (!outcome.ok) {
      return this.failedFromQuery(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        roleAssignments: Object.freeze(outcome.value.roleAssignments.map((assignment) => toWorkspaceRoleAssignment(assignment))),
        pagination: outcome.value.pagination,
        workspaceRoleSummary: outcome.value.workspaceRoleSummary,
      }),
    });
  }

  public async createWorkspace(
    request: CreateWorkspaceAdministrationApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<CreateWorkspaceAdministrationApiResponse>> {
    const outcome = await this.dependencies.createWorkspaceUseCase.execute({
      slug: request.slug,
      displayName: request.displayName,
      description: request.description,
      visibility: request.visibility,
      status: request.status,
      actorUserIdentityId: request.actorUserIdentityId,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return this.workspaceSuccessRecord(request.actorUserIdentityId, outcome.value.workspace.id, (workspace) => Object.freeze({
      workspace,
    }));
  }

  public async updateWorkspace(
    request: UpdateWorkspaceAdministrationApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<UpdateWorkspaceAdministrationApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.updateWorkspaceUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      displayName: request.displayName,
      description: request.description,
      visibility: request.visibility,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return this.workspaceSuccessRecord(request.actorUserIdentityId, outcome.value.workspace.id, (workspace) => Object.freeze({
      workspace,
      changed: outcome.value.changed,
    }));
  }

  public async transitionWorkspaceLifecycle(
    request: TransitionWorkspaceAdministrationLifecycleApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<TransitionWorkspaceAdministrationLifecycleApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.transitionWorkspaceLifecycleUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      action: request.action,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return this.workspaceSuccessRecord(request.actorUserIdentityId, outcome.value.workspace.id, (workspace) => Object.freeze({
      workspace,
      changed: outcome.value.changed,
    }));
  }

  public async addWorkspaceMember(
    request: AddWorkspaceAdministrationMemberApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<AddWorkspaceAdministrationMemberApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.addWorkspaceMemberUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      targetUserIdentityId: request.targetUserIdentityId,
      initialStatus: request.initialStatus,
      roles: request.roles,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        membership: toMembershipFromDomain(outcome.value.membership),
        roleAssignments: Object.freeze(outcome.value.roleAssignments.map((assignment) => toRoleAssignmentFromDomain(assignment))),
      }),
    });
  }

  public async changeWorkspaceMembershipStatus(
    request: ChangeWorkspaceAdministrationMemberStatusApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ChangeWorkspaceAdministrationMemberStatusApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.changeWorkspaceMembershipStatusUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      targetUserIdentityId: request.targetUserIdentityId,
      status: request.status,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        membership: toMembershipFromDomain(outcome.value.membership),
        changed: outcome.value.changed,
        revokedRoleAssignmentIds: outcome.value.revokedRoleAssignmentIds,
      }),
    });
  }

  public async removeWorkspaceMember(
    request: RemoveWorkspaceAdministrationMemberApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<RemoveWorkspaceAdministrationMemberApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.removeWorkspaceMemberUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      targetUserIdentityId: request.targetUserIdentityId,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        membership: toMembershipFromDomain(outcome.value.membership),
        changed: outcome.value.changed,
        revokedRoleAssignmentIds: outcome.value.revokedRoleAssignmentIds,
      }),
    });
  }

  public async assignWorkspaceRole(
    request: AssignWorkspaceAdministrationRoleApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<AssignWorkspaceAdministrationRoleApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.assignWorkspaceRoleUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      targetUserIdentityId: request.targetUserIdentityId,
      role: request.role,
      audit: toRoleAudit(request.reason, request.correlationId, request.metadata),
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        roleAssignment: toRoleAssignmentFromDomain(outcome.value.roleAssignment),
        changed: outcome.value.changed,
      }),
    });
  }

  public async reassignWorkspaceRole(
    request: ReassignWorkspaceAdministrationRoleApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<ReassignWorkspaceAdministrationRoleApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.reassignWorkspaceRoleUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      targetUserIdentityId: request.targetUserIdentityId,
      fromRole: request.fromRole,
      toRole: request.toRole,
      audit: toRoleAudit(request.reason, request.correlationId, request.metadata),
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        revokedRoleAssignment: toRoleAssignmentFromDomain(outcome.value.revokedRoleAssignment),
        assignedRoleAssignment: toRoleAssignmentFromDomain(outcome.value.assignedRoleAssignment),
        changed: outcome.value.changed,
      }),
    });
  }

  public async revokeWorkspaceRole(
    request: RevokeWorkspaceAdministrationRoleApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<RevokeWorkspaceAdministrationRoleApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.revokeWorkspaceRoleUseCase.execute({
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      targetUserIdentityId: request.targetUserIdentityId,
      role: request.role,
      audit: toRoleAudit(request.reason, request.correlationId, request.metadata),
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        roleAssignment: toRoleAssignmentFromDomain(outcome.value.roleAssignment),
        changed: outcome.value.changed,
      }),
    });
  }

  public async cancelWorkspaceInvitation(
    request: CancelWorkspaceAdministrationInvitationApiRequest,
  ): Promise<WorkspaceAdministrationApiResponse<CancelWorkspaceAdministrationInvitationApiResponse>> {
    const authorizationFailure = await this.assertWorkspaceAdministrationMutationAuthorized(
      request.workspaceId,
      request.actorUserIdentityId,
    );
    if (authorizationFailure) {
      return authorizationFailure;
    }

    const outcome = await this.dependencies.resolveWorkspaceInvitationLifecycleUseCase.execute({
      action: WorkspaceInvitationLifecycleActions.cancel,
      workspaceId: request.workspaceId,
      actorUserIdentityId: request.actorUserIdentityId,
      invitationId: request.invitationId,
    });

    if (!outcome.ok) {
      return this.failedFromMutation(outcome.error.code, outcome.error.message);
    }

    return Object.freeze({
      ok: true,
      data: Object.freeze({
        invitation: toInvitationFromDomain(outcome.value.invitation, this.clock.now().toISOString()),
        changed: outcome.value.changed,
      }),
    });
  }

  private async workspaceSuccessRecord<TData>(
    actorUserIdentityId: string,
    workspaceId: string,
    selectData: (workspace: WorkspaceAdminListItemApiRecord) => TData,
  ): Promise<WorkspaceAdministrationApiResponse<TData>> {
    const view = await this.readWorkspaceAdministrationView({
      workspaceId,
      actorUserIdentityId,
    });

    if (!view.ok || !view.data) {
      return this.failed(
        WorkspaceAdministrationApiErrorCodes.internal,
        view.error?.message ?? "Workspace administration view could not be loaded.",
      );
    }

    return Object.freeze({
      ok: true,
      data: selectData(view.data.workspace),
    });
  }

  private async getActorAccessSummary(
    workspaceId: string,
    actorUserIdentityId: string,
  ): Promise<WorkspaceAdministrativeActorAccessWithCapabilities> {
    const snapshot = await this.dependencies.authorizationReadRepository.getWorkspaceAuthorizationSnapshot({
      workspaceId,
      userIdentityId: actorUserIdentityId,
      asOf: this.clock.now().toISOString(),
    });

    const effectiveRoles = Object.freeze([
      ...new Set(snapshot?.activeRoleAssignments
        .filter((assignment) => assignment.status === WorkspaceRoleAssignmentStatuses.active)
        .map((assignment) => assignment.role) ?? []),
    ]);

    const actorAccess = Object.freeze({
      membershipStatus: snapshot?.membership?.status,
      effectiveRoles,
      canAdministrate: effectiveRoles.includes(WorkspaceRoles.owner) || effectiveRoles.includes(WorkspaceRoles.admin),
      isWorkspaceOwner: effectiveRoles.includes(WorkspaceRoles.owner),
      capabilities: Object.freeze({
        canManageWorkspaceSettings: false,
        canManageMembers: false,
        canManageInvitations: false,
        canManageRoles: false,
      }),
    });

    return this.withActorAccessCapabilities(workspaceId, actorUserIdentityId, actorAccess);
  }

  private async assertWorkspaceAdministrationMutationAuthorized(
    workspaceId: string,
    actorUserIdentityId: string,
  ): Promise<WorkspaceAdministrationApiResponse<never> | undefined> {
    const normalizedWorkspaceId = workspaceId.trim();
    if (!normalizedWorkspaceId) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidRequest, "workspaceId is required.");
    }

    const normalizedActorUserIdentityId = actorUserIdentityId.trim();
    if (!normalizedActorUserIdentityId) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidRequest, "actorUserIdentityId is required.");
    }

    const workspace = await this.dependencies.workspaceRepository.findWorkspaceById(normalizedWorkspaceId);
    if (!workspace) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.notFound, `Workspace '${normalizedWorkspaceId}' was not found.`);
    }

    let decision: Awaited<ReturnType<IAuthorizationPolicyDecisionEvaluator["evaluateDecision"]>> | undefined;
    try {
      decision = await this.evaluateWorkspaceAdministrationManageDecision(normalizedWorkspaceId, normalizedActorUserIdentityId);
    } catch (error) {
      return this.failed(
        WorkspaceAdministrationApiErrorCodes.internal,
        error instanceof Error ? error.message : "Workspace administration authorization evaluation failed.",
      );
    }

    if (!decision) {
      return undefined;
    }

    if (decision.decision.isAllowed) {
      return undefined;
    }

    return this.failed(
      WorkspaceAdministrationApiErrorCodes.forbidden,
      decision.decision.reason,
    );
  }

  private failedFromQuery(code: WorkspaceAdministrationQueryErrorCode, message: string): WorkspaceAdministrationApiResponse<never> {
    if (code.endsWith("invalid-request")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidRequest, message);
    }
    if (code.endsWith("not-found")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.notFound, message);
    }
    return this.failed(WorkspaceAdministrationApiErrorCodes.forbidden, message);
  }

  private failedFromMutation(code: string, message: string): WorkspaceAdministrationApiResponse<never> {
    if (code.includes("invalid-request")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidRequest, message);
    }
    if (code.includes("invalid-transition")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.invalidTransition, message);
    }
    if (code.includes("forbidden")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.forbidden, message);
    }
    if (code.includes("not-found") || code.includes("invalid-token")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.notFound, message);
    }
    if (code.includes("conflict")) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.conflict, message);
    }
    return this.failed(WorkspaceAdministrationApiErrorCodes.internal, message);
  }

  private failed(
    code: WorkspaceAdministrationApiError["code"],
    message: string,
  ): WorkspaceAdministrationApiResponse<never> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({ code, message }),
    });
  }

  private failedFromApiError(error?: WorkspaceAdministrationApiError): WorkspaceAdministrationApiResponse<never> {
    if (!error) {
      return this.failed(WorkspaceAdministrationApiErrorCodes.internal, "Workspace administration request failed.");
    }
    return this.failed(error.code, error.message);
  }

  private async withActorAccessCapabilities(
    workspaceId: string,
    actorUserIdentityId: string,
    actorAccess: WorkspaceAdministrativeActorAccessSummary,
  ): Promise<WorkspaceAdministrativeActorAccessWithCapabilities> {
    let canManage = actorAccess.canAdministrate;
    try {
      const decision = await this.evaluateWorkspaceAdministrationManageDecision(workspaceId, actorUserIdentityId);
      canManage = decision?.decision.isAllowed ?? actorAccess.canAdministrate;
    } catch {
      canManage = actorAccess.canAdministrate;
    }

    return Object.freeze({
      ...actorAccess,
      capabilities: Object.freeze({
        canManageWorkspaceSettings: canManage,
        canManageMembers: canManage,
        canManageInvitations: canManage,
        canManageRoles: canManage,
      }),
    });
  }

  private async evaluateWorkspaceAdministrationManageDecision(
    workspaceId: string,
    actorUserIdentityId: string,
  ): Promise<Awaited<ReturnType<IAuthorizationPolicyDecisionEvaluator["evaluateDecision"]>> | undefined> {
    if (!this.dependencies.authorizationPolicyDecisionEvaluator) {
      return undefined;
    }

    return this.dependencies.authorizationPolicyDecisionEvaluator.evaluateDecision({
      actor: Object.freeze({
        actorUserIdentityId,
        activeWorkspaceId: workspaceId,
      }),
      requiredPermissionKey: "system.manage",
      target: Object.freeze({
        kind: AuthorizationPolicyEvaluationTargetKinds.workspaceCapability,
        workspaceId,
        capabilityResourceType: this.workspaceAdministrationCapabilityResourceType,
      }),
      asOf: this.clock.now().toISOString(),
    });
  }
}

function toWorkspaceAdminListItem(value: {
  readonly id: string;
  readonly slug: string;
  readonly displayName: string;
  readonly description?: string;
  readonly status: Workspace["status"];
  readonly ownerUserIdentityId: string;
  readonly visibility: Workspace["ownership"]["visibility"];
  readonly createdAt: string;
  readonly lastModifiedAt: string;
  readonly membershipSummary: WorkspaceMembershipStatusSummary;
  readonly roleSummary: WorkspaceRoleSummary;
  readonly invitationSummary: WorkspaceInvitationStatusSummary;
  readonly actorAccess: WorkspaceAdministrativeActorAccessWithCapabilities;
}): WorkspaceAdminListItemApiRecord {
  return Object.freeze({
    workspaceId: value.id,
    slug: value.slug,
    displayName: value.displayName,
    description: value.description,
    status: value.status,
    ownerUserIdentityId: value.ownerUserIdentityId,
    visibility: value.visibility,
    createdAt: value.createdAt,
    lastModifiedAt: value.lastModifiedAt,
    membershipSummary: value.membershipSummary,
    roleSummary: value.roleSummary,
    invitationSummary: value.invitationSummary,
    actorAccess: value.actorAccess,
  });
}

function toWorkspaceMembership(value: WorkspaceMembershipItemDto): WorkspaceMembershipApiRecord {
  return Object.freeze({
    membershipId: value.membershipId,
    workspaceId: value.workspaceId,
    userIdentityId: value.userIdentityId,
    status: value.status,
    invitedByUserIdentityId: value.invitedByUserId,
    invitationId: value.invitationId,
    joinedAt: value.joinedAt,
    suspendedAt: value.suspendedAt,
    removedAt: value.removedAt,
    removedByUserIdentityId: value.removedByUserId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    createdByUserIdentityId: value.createdBy,
    lastModifiedByUserIdentityId: value.lastModifiedBy,
    activeRoles: value.activeRoles,
    hasAdministrativeRole: value.hasAdministrativeRole,
    isWorkspaceOwner: value.isWorkspaceOwner,
  });
}

function toMembershipFromDomain(value: {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: WorkspaceMembershipApiRecord["status"];
  readonly invitedByUserId?: string;
  readonly invitationId?: string;
  readonly joinedAt?: string;
  readonly suspendedAt?: string;
  readonly removedAt?: string;
  readonly removedByUserId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
}): WorkspaceMembershipApiRecord {
  return Object.freeze({
    membershipId: value.id,
    workspaceId: value.workspaceId,
    userIdentityId: value.userIdentityId,
    status: value.status,
    invitedByUserIdentityId: value.invitedByUserId,
    invitationId: value.invitationId,
    joinedAt: value.joinedAt,
    suspendedAt: value.suspendedAt,
    removedAt: value.removedAt,
    removedByUserIdentityId: value.removedByUserId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    createdByUserIdentityId: value.createdBy,
    lastModifiedByUserIdentityId: value.lastModifiedBy,
    activeRoles: Object.freeze([]),
    hasAdministrativeRole: false,
    isWorkspaceOwner: false,
  });
}

function toWorkspaceInvitation(value: WorkspaceInvitationItemDto): WorkspaceInvitationApiRecord {
  return Object.freeze({
    invitationId: value.invitationId,
    workspaceId: value.workspaceId,
    invitedEmail: value.invitedEmail,
    invitedByUserIdentityId: value.invitedByUserId,
    invitedRoles: value.invitedRoles,
    status: value.status,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    respondedAt: value.respondedAt,
    acceptedByUserIdentityId: value.acceptedByUserIdentityId,
    isActive: value.isActive,
    isExpiredAsOfQuery: value.isExpiredAsOfQuery,
  });
}

function toInvitationFromDomain(
  value: {
    readonly id: string;
    readonly workspaceId: string;
    readonly invitedEmail: string;
    readonly invitedByUserId: string;
    readonly invitedRoles: ReadonlyArray<WorkspaceRole>;
    readonly status: WorkspaceInvitationApiRecord["status"];
    readonly createdAt: string;
    readonly expiresAt: string;
    readonly respondedAt?: string;
    readonly acceptedByUserIdentityId?: string;
  },
  asOf: string,
): WorkspaceInvitationApiRecord {
  const expiresAt = new Date(value.expiresAt).getTime();
  const asOfTime = new Date(asOf).getTime();
  const isExpiredAsOfQuery = !Number.isNaN(expiresAt) && !Number.isNaN(asOfTime) && expiresAt <= asOfTime;
  return Object.freeze({
    invitationId: value.id,
    workspaceId: value.workspaceId,
    invitedEmail: value.invitedEmail,
    invitedByUserIdentityId: value.invitedByUserId,
    invitedRoles: value.invitedRoles,
    status: value.status,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    respondedAt: value.respondedAt,
    acceptedByUserIdentityId: value.acceptedByUserIdentityId,
    isActive: value.status === "pending" && !isExpiredAsOfQuery,
    isExpiredAsOfQuery,
  });
}

function toWorkspaceRoleAssignment(value: WorkspaceRoleAssignmentItemDto): WorkspaceRoleAssignmentApiRecord {
  return Object.freeze({
    roleAssignmentId: value.roleAssignmentId,
    workspaceId: value.workspaceId,
    userIdentityId: value.userIdentityId,
    role: value.role,
    status: value.status,
    assignedAt: value.assignedAt,
    assignedByUserIdentityId: value.assignedBy,
    revokedAt: value.revokedAt,
    revokedByUserIdentityId: value.revokedBy,
    isAdministrativeRole: value.isAdministrativeRole,
  });
}

function toRoleAssignmentFromDomain(value: {
  readonly id: string;
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly role: WorkspaceRole;
  readonly status: WorkspaceRoleAssignmentApiRecord["status"];
  readonly assignedAt: string;
  readonly assignedBy: string;
  readonly revokedAt?: string;
  readonly revokedBy?: string;
}): WorkspaceRoleAssignmentApiRecord {
  return Object.freeze({
    roleAssignmentId: value.id,
    workspaceId: value.workspaceId,
    userIdentityId: value.userIdentityId,
    role: value.role,
    status: value.status,
    assignedAt: value.assignedAt,
    assignedByUserIdentityId: value.assignedBy,
    revokedAt: value.revokedAt,
    revokedByUserIdentityId: value.revokedBy,
    isAdministrativeRole: value.role === WorkspaceRoles.owner || value.role === WorkspaceRoles.admin,
  });
}

function toRoleAudit(
  reason?: string,
  correlationId?: string,
  metadata?: Readonly<Record<string, unknown>>,
): { readonly reason?: string; readonly correlationId?: string; readonly metadata?: Readonly<Record<string, unknown>> } | undefined {
  if (!reason && !correlationId && !metadata) {
    return undefined;
  }

  return Object.freeze({
    reason,
    correlationId,
    metadata,
  });
}
