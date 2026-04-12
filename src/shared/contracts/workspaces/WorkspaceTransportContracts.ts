import type {
  AddWorkspaceAdministrationMemberApiRequest,
  AddWorkspaceAdministrationMemberApiResponse,
  AssignWorkspaceAdministrationRoleApiRequest,
  AssignWorkspaceAdministrationRoleApiResponse,
  CancelWorkspaceAdministrationInvitationApiRequest,
  CancelWorkspaceAdministrationInvitationApiResponse,
  ChangeWorkspaceAdministrationMemberStatusApiRequest,
  ChangeWorkspaceAdministrationMemberStatusApiResponse,
  CreateWorkspaceAdministrationApiRequest,
  CreateWorkspaceAdministrationApiResponse,
  ListWorkspaceAdministrationInvitationsApiRequest,
  ListWorkspaceAdministrationInvitationsApiResponse,
  ListWorkspaceAdministrationMembershipsApiRequest,
  ListWorkspaceAdministrationMembershipsApiResponse,
  ListWorkspaceAdministrationRoleAssignmentsApiRequest,
  ListWorkspaceAdministrationRoleAssignmentsApiResponse,
  ListWorkspaceAdministrationWorkspacesApiRequest,
  ListWorkspaceAdministrationWorkspacesApiResponse,
  ReadWorkspaceAdministrationViewApiRequest,
  ReadWorkspaceAdministrationViewApiResponse,
  ReassignWorkspaceAdministrationRoleApiRequest,
  ReassignWorkspaceAdministrationRoleApiResponse,
  RemoveWorkspaceAdministrationMemberApiRequest,
  RemoveWorkspaceAdministrationMemberApiResponse,
  RevokeWorkspaceAdministrationRoleApiRequest,
  RevokeWorkspaceAdministrationRoleApiResponse,
  TransitionWorkspaceAdministrationLifecycleApiRequest,
  TransitionWorkspaceAdministrationLifecycleApiResponse,
  UpdateWorkspaceAdministrationApiRequest,
  UpdateWorkspaceAdministrationApiResponse,
  WorkspaceAdministrationApiResponse,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import type {
  AcceptWorkspaceInvitationOnboardingApiRequest,
  AcceptWorkspaceInvitationOnboardingApiResponse,
  IssueWorkspaceInvitationApiRequest,
  IssueWorkspaceInvitationApiResponse,
  WorkspaceInvitationApiResponse,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceInvitationApiContract";
export type * from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
export type * from "@infrastructure/api/workspaces/sdk/PublicWorkspaceInvitationApiContract";
export {
  WorkspaceAdministrationApiErrorCodes,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
export {
  WorkspaceInvitationApiErrorCodes,
} from "@infrastructure/api/workspaces/sdk/PublicWorkspaceInvitationApiContract";

export const WorkspaceTransportRoutes = Object.freeze({
  listWorkspaces: "/api/v1/workspaces",
  createWorkspace: "/api/v1/workspaces",
  readWorkspaceAdministrationView: "/api/v1/workspaces/:workspaceId/admin-view",
  updateWorkspace: "/api/v1/workspaces/:workspaceId",
  transitionWorkspaceLifecycle: "/api/v1/workspaces/:workspaceId/lifecycle",
  listWorkspaceMemberships: "/api/v1/workspaces/:workspaceId/members",
  addWorkspaceMember: "/api/v1/workspaces/:workspaceId/members",
  changeWorkspaceMembershipStatus: "/api/v1/workspaces/:workspaceId/members/:targetUserIdentityId/status",
  removeWorkspaceMember: "/api/v1/workspaces/:workspaceId/members/:targetUserIdentityId",
  listWorkspaceInvitations: "/api/v1/workspaces/:workspaceId/invitations",
  issueWorkspaceInvitation: "/api/v1/workspaces/:workspaceId/invitations",
  acceptWorkspaceInvitationOnboarding: "/api/v1/workspaces/:workspaceId/onboarding/accept",
  cancelWorkspaceInvitation: "/api/v1/workspaces/:workspaceId/invitations/:invitationId",
  listWorkspaceRoleAssignments: "/api/v1/workspaces/:workspaceId/roles",
  assignWorkspaceRole: "/api/v1/workspaces/:workspaceId/roles/assign",
  reassignWorkspaceRole: "/api/v1/workspaces/:workspaceId/roles/reassign",
  revokeWorkspaceRole: "/api/v1/workspaces/:workspaceId/roles/revoke",
} as const);

export interface WorkspaceAdministrationTransportContract {
  readonly listWorkspaces: {
    readonly request: ListWorkspaceAdministrationWorkspacesApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationWorkspacesApiResponse>;
  };
  readonly createWorkspace: {
    readonly request: CreateWorkspaceAdministrationApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<CreateWorkspaceAdministrationApiResponse>;
  };
  readonly readWorkspaceAdministrationView: {
    readonly request: ReadWorkspaceAdministrationViewApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ReadWorkspaceAdministrationViewApiResponse>;
  };
  readonly updateWorkspace: {
    readonly request: UpdateWorkspaceAdministrationApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<UpdateWorkspaceAdministrationApiResponse>;
  };
  readonly transitionWorkspaceLifecycle: {
    readonly request: TransitionWorkspaceAdministrationLifecycleApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<TransitionWorkspaceAdministrationLifecycleApiResponse>;
  };
  readonly listWorkspaceMemberships: {
    readonly request: ListWorkspaceAdministrationMembershipsApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationMembershipsApiResponse>;
  };
  readonly addWorkspaceMember: {
    readonly request: AddWorkspaceAdministrationMemberApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<AddWorkspaceAdministrationMemberApiResponse>;
  };
  readonly changeWorkspaceMembershipStatus: {
    readonly request: ChangeWorkspaceAdministrationMemberStatusApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ChangeWorkspaceAdministrationMemberStatusApiResponse>;
  };
  readonly removeWorkspaceMember: {
    readonly request: RemoveWorkspaceAdministrationMemberApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<RemoveWorkspaceAdministrationMemberApiResponse>;
  };
  readonly listWorkspaceInvitations: {
    readonly request: ListWorkspaceAdministrationInvitationsApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationInvitationsApiResponse>;
  };
  readonly issueWorkspaceInvitation: {
    readonly request: IssueWorkspaceInvitationApiRequest;
    readonly response: WorkspaceInvitationApiResponse<IssueWorkspaceInvitationApiResponse>;
  };
  readonly acceptWorkspaceInvitationOnboarding: {
    readonly request: AcceptWorkspaceInvitationOnboardingApiRequest;
    readonly response: WorkspaceInvitationApiResponse<AcceptWorkspaceInvitationOnboardingApiResponse>;
  };
  readonly cancelWorkspaceInvitation: {
    readonly request: CancelWorkspaceAdministrationInvitationApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<CancelWorkspaceAdministrationInvitationApiResponse>;
  };
  readonly listWorkspaceRoleAssignments: {
    readonly request: ListWorkspaceAdministrationRoleAssignmentsApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationRoleAssignmentsApiResponse>;
  };
  readonly assignWorkspaceRole: {
    readonly request: AssignWorkspaceAdministrationRoleApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<AssignWorkspaceAdministrationRoleApiResponse>;
  };
  readonly reassignWorkspaceRole: {
    readonly request: ReassignWorkspaceAdministrationRoleApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<ReassignWorkspaceAdministrationRoleApiResponse>;
  };
  readonly revokeWorkspaceRole: {
    readonly request: RevokeWorkspaceAdministrationRoleApiRequest;
    readonly response: WorkspaceAdministrationApiResponse<RevokeWorkspaceAdministrationRoleApiResponse>;
  };
}
