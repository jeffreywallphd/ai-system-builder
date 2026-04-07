import type {
  AddWorkspaceAdministrationMemberApiResponse,
  AcceptWorkspaceInvitationOnboardingApiResponse,
  AssignWorkspaceAdministrationRoleApiResponse,
  CancelWorkspaceAdministrationInvitationApiResponse,
  ChangeWorkspaceAdministrationMemberStatusApiResponse,
  CreateWorkspaceAdministrationApiResponse,
  IssueWorkspaceInvitationApiResponse,
  ListWorkspaceAdministrationInvitationsApiResponse,
  ListWorkspaceAdministrationMembershipsApiResponse,
  ListWorkspaceAdministrationRoleAssignmentsApiResponse,
  ListWorkspaceAdministrationWorkspacesApiResponse,
  ReadWorkspaceAdministrationViewApiResponse,
  ReassignWorkspaceAdministrationRoleApiResponse,
  RemoveWorkspaceAdministrationMemberApiResponse,
  RevokeWorkspaceAdministrationRoleApiResponse,
  TransitionWorkspaceAdministrationLifecycleApiResponse,
  UpdateWorkspaceAdministrationApiResponse,
  WorkspaceAdministrationApiResponse,
  WorkspaceInvitationApiResponse,
} from "@shared/contracts/workspaces/WorkspaceTransportContracts";
import {
  appendSharedApiListQueryConventions,
  appendSharedApiQueryBoolean,
  appendSharedApiQueryList,
  appendSharedApiQueryValue,
  toSharedApiQuerySuffix,
} from "@shared/contracts/api/SharedApiQueryConventions";
import { SharedApiClient } from "@ui/shared/api/SharedApiClient";

/* MIGRATION NOTE: request DTOs in this client still include inline compatibility shapes.
 * New features should consume request/response contracts directly from src/shared/contracts/workspaces.
 */
export interface WorkspaceAdministrationClient {
  listWorkspaces(
    request: {
      readonly ownerUserIdentityId?: string;
      readonly statuses?: ReadonlyArray<"provisioning" | "active" | "suspended" | "archived">;
      readonly visibility?: "private" | "team" | "public";
      readonly slugPrefix?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationWorkspacesApiResponse>>;
  createWorkspace(
    request: {
      readonly slug: string;
      readonly displayName: string;
      readonly description?: string;
      readonly visibility?: "private" | "team" | "public";
      readonly status?: "provisioning" | "active" | "suspended" | "archived";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<CreateWorkspaceAdministrationApiResponse>>;
  readWorkspaceAdministrationView(
    request: {
      readonly workspaceId: string;
      readonly asOf?: string;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ReadWorkspaceAdministrationViewApiResponse>>;
  updateWorkspace(
    request: {
      readonly workspaceId: string;
      readonly displayName?: string;
      readonly description?: string;
      readonly visibility?: "private" | "team" | "public";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<UpdateWorkspaceAdministrationApiResponse>>;
  transitionWorkspaceLifecycle(
    request: {
      readonly workspaceId: string;
      readonly action: "archive" | "reactivate" | "suspend" | "activate";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<TransitionWorkspaceAdministrationLifecycleApiResponse>>;
  listWorkspaceMemberships(
    request: {
      readonly workspaceId: string;
      readonly userIdentityId?: string;
      readonly statuses?: ReadonlyArray<"pending" | "active" | "suspended" | "removed">;
      readonly invitationId?: string;
      readonly invitedByUserIdentityId?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationMembershipsApiResponse>>;
  addWorkspaceMember(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly initialStatus?: "pending" | "active" | "suspended" | "removed";
      readonly roles?: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<AddWorkspaceAdministrationMemberApiResponse>>;
  changeWorkspaceMembershipStatus(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly status: "pending" | "active" | "suspended" | "removed";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ChangeWorkspaceAdministrationMemberStatusApiResponse>>;
  removeWorkspaceMember(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<RemoveWorkspaceAdministrationMemberApiResponse>>;
  listWorkspaceInvitations(
    request: {
      readonly workspaceId: string;
      readonly invitedEmail?: string;
      readonly invitedByUserIdentityId?: string;
      readonly statuses?: ReadonlyArray<"pending" | "accepted" | "declined" | "revoked" | "expired">;
      readonly activeOnly?: boolean;
      readonly expiresBefore?: string;
      readonly expiresAfter?: string;
      readonly asOf?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationInvitationsApiResponse>>;
  issueWorkspaceInvitation(
    request: {
      readonly workspaceId: string;
      readonly invitedEmail: string;
      readonly invitedRoles: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
      readonly expiresAt?: string;
      readonly expiresInMs?: number;
      readonly targetUserIdentityIdHint?: string;
      readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceInvitationApiResponse<IssueWorkspaceInvitationApiResponse>>;
  acceptWorkspaceInvitationOnboarding(
    request: {
      readonly workspaceId: string;
      readonly invitationToken: string;
      readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceInvitationApiResponse<AcceptWorkspaceInvitationOnboardingApiResponse>>;
  cancelWorkspaceInvitation(
    request: {
      readonly workspaceId: string;
      readonly invitationId: string;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<CancelWorkspaceAdministrationInvitationApiResponse>>;
  listWorkspaceRoleAssignments(
    request: {
      readonly workspaceId: string;
      readonly userIdentityId?: string;
      readonly roles?: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
      readonly statuses?: ReadonlyArray<"active" | "revoked">;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationRoleAssignmentsApiResponse>>;
  assignWorkspaceRole(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly role: "owner" | "admin" | "member" | "viewer";
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<AssignWorkspaceAdministrationRoleApiResponse>>;
  reassignWorkspaceRole(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly fromRole: "owner" | "admin" | "member" | "viewer";
      readonly toRole: "owner" | "admin" | "member" | "viewer";
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ReassignWorkspaceAdministrationRoleApiResponse>>;
  revokeWorkspaceRole(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly role: "owner" | "admin" | "member" | "viewer";
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<RevokeWorkspaceAdministrationRoleApiResponse>>;
}

export class HttpWorkspaceAdministrationClient implements WorkspaceAdministrationClient {
  private readonly apiClient: SharedApiClient;

  public constructor(
    baseUrl: string,
    options: Omit<ConstructorParameters<typeof SharedApiClient>[0], "baseUrl"> = {},
  ) {
    this.apiClient = new SharedApiClient({
      baseUrl,
      ...options,
    });
  }

  public async listWorkspaces(
    request: {
      readonly ownerUserIdentityId?: string;
      readonly statuses?: ReadonlyArray<"provisioning" | "active" | "suspended" | "archived">;
      readonly visibility?: "private" | "team" | "public";
      readonly slugPrefix?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationWorkspacesApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "ownerUserIdentityId", request.ownerUserIdentityId);
    appendSharedApiQueryList(query, "status", request.statuses);
    appendSharedApiQueryValue(query, "visibility", request.visibility);
    appendSharedApiQueryValue(query, "slugPrefix", request.slugPrefix);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    return this.get(`/api/v1/workspaces${toSharedApiQuerySuffix(query)}`, sessionToken);
  }

  public async createWorkspace(
    request: {
      readonly slug: string;
      readonly displayName: string;
      readonly description?: string;
      readonly visibility?: "private" | "team" | "public";
      readonly status?: "provisioning" | "active" | "suspended" | "archived";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<CreateWorkspaceAdministrationApiResponse>> {
    return this.post("/api/v1/workspaces", request, sessionToken);
  }

  public async readWorkspaceAdministrationView(
    request: {
      readonly workspaceId: string;
      readonly asOf?: string;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ReadWorkspaceAdministrationViewApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "asOf", request.asOf);
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/admin-view${toSharedApiQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async updateWorkspace(
    request: {
      readonly workspaceId: string;
      readonly displayName?: string;
      readonly description?: string;
      readonly visibility?: "private" | "team" | "public";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<UpdateWorkspaceAdministrationApiResponse>> {
    return this.patch(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}`,
      Object.freeze({
        displayName: request.displayName,
        description: request.description,
        visibility: request.visibility,
      }),
      sessionToken,
    );
  }

  public async transitionWorkspaceLifecycle(
    request: {
      readonly workspaceId: string;
      readonly action: "archive" | "reactivate" | "suspend" | "activate";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<TransitionWorkspaceAdministrationLifecycleApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/lifecycle`,
      Object.freeze({ action: request.action }),
      sessionToken,
    );
  }

  public async listWorkspaceMemberships(
    request: {
      readonly workspaceId: string;
      readonly userIdentityId?: string;
      readonly statuses?: ReadonlyArray<"pending" | "active" | "suspended" | "removed">;
      readonly invitationId?: string;
      readonly invitedByUserIdentityId?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationMembershipsApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "userIdentityId", request.userIdentityId);
    appendSharedApiQueryList(query, "status", request.statuses);
    appendSharedApiQueryValue(query, "invitationId", request.invitationId);
    appendSharedApiQueryValue(query, "invitedByUserIdentityId", request.invitedByUserIdentityId);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/members${toSharedApiQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async addWorkspaceMember(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly initialStatus?: "pending" | "active" | "suspended" | "removed";
      readonly roles?: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<AddWorkspaceAdministrationMemberApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/members`,
      Object.freeze({
        targetUserIdentityId: request.targetUserIdentityId,
        initialStatus: request.initialStatus,
        roles: request.roles,
      }),
      sessionToken,
    );
  }

  public async changeWorkspaceMembershipStatus(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly status: "pending" | "active" | "suspended" | "removed";
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ChangeWorkspaceAdministrationMemberStatusApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/members/${encodeURIComponent(request.targetUserIdentityId)}/status`,
      Object.freeze({ status: request.status }),
      sessionToken,
    );
  }

  public async removeWorkspaceMember(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<RemoveWorkspaceAdministrationMemberApiResponse>> {
    return this.delete(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/members/${encodeURIComponent(request.targetUserIdentityId)}`,
      sessionToken,
    );
  }

  public async listWorkspaceInvitations(
    request: {
      readonly workspaceId: string;
      readonly invitedEmail?: string;
      readonly invitedByUserIdentityId?: string;
      readonly statuses?: ReadonlyArray<"pending" | "accepted" | "declined" | "revoked" | "expired">;
      readonly activeOnly?: boolean;
      readonly expiresBefore?: string;
      readonly expiresAfter?: string;
      readonly asOf?: string;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationInvitationsApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "invitedEmail", request.invitedEmail);
    appendSharedApiQueryValue(query, "invitedByUserIdentityId", request.invitedByUserIdentityId);
    appendSharedApiQueryList(query, "status", request.statuses);
    appendSharedApiQueryBoolean(query, "activeOnly", request.activeOnly);
    appendSharedApiQueryValue(query, "expiresBefore", request.expiresBefore);
    appendSharedApiQueryValue(query, "expiresAfter", request.expiresAfter);
    appendSharedApiQueryValue(query, "asOf", request.asOf);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/invitations${toSharedApiQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async issueWorkspaceInvitation(
    request: {
      readonly workspaceId: string;
      readonly invitedEmail: string;
      readonly invitedRoles: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
      readonly expiresAt?: string;
      readonly expiresInMs?: number;
      readonly targetUserIdentityIdHint?: string;
      readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceInvitationApiResponse<IssueWorkspaceInvitationApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/invitations`,
      Object.freeze({
        invitedEmail: request.invitedEmail,
        invitedRoles: request.invitedRoles,
        expiresAt: request.expiresAt,
        expiresInMs: request.expiresInMs,
        targetUserIdentityIdHint: request.targetUserIdentityIdHint,
        onboardingMetadata: request.onboardingMetadata,
      }),
      sessionToken,
    );
  }

  public async acceptWorkspaceInvitationOnboarding(
    request: {
      readonly workspaceId: string;
      readonly invitationToken: string;
      readonly onboardingMetadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceInvitationApiResponse<AcceptWorkspaceInvitationOnboardingApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/onboarding/accept`,
      Object.freeze({
        invitationToken: request.invitationToken,
        onboardingMetadata: request.onboardingMetadata,
      }),
      sessionToken,
    );
  }

  public async cancelWorkspaceInvitation(
    request: {
      readonly workspaceId: string;
      readonly invitationId: string;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<CancelWorkspaceAdministrationInvitationApiResponse>> {
    return this.delete(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/invitations/${encodeURIComponent(request.invitationId)}`,
      sessionToken,
    );
  }

  public async listWorkspaceRoleAssignments(
    request: {
      readonly workspaceId: string;
      readonly userIdentityId?: string;
      readonly roles?: ReadonlyArray<"owner" | "admin" | "member" | "viewer">;
      readonly statuses?: ReadonlyArray<"active" | "revoked">;
      readonly limit?: number;
      readonly offset?: number;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ListWorkspaceAdministrationRoleAssignmentsApiResponse>> {
    const query = new URLSearchParams();
    appendSharedApiQueryValue(query, "userIdentityId", request.userIdentityId);
    appendSharedApiQueryList(query, "role", request.roles);
    appendSharedApiQueryList(query, "status", request.statuses);
    appendSharedApiListQueryConventions(query, {
      pagination: {
        limit: request.limit,
        offset: request.offset,
      },
    });
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/roles${toSharedApiQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async assignWorkspaceRole(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly role: "owner" | "admin" | "member" | "viewer";
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<AssignWorkspaceAdministrationRoleApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/roles/assign`,
      Object.freeze({
        targetUserIdentityId: request.targetUserIdentityId,
        role: request.role,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
      sessionToken,
    );
  }

  public async reassignWorkspaceRole(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly fromRole: "owner" | "admin" | "member" | "viewer";
      readonly toRole: "owner" | "admin" | "member" | "viewer";
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<ReassignWorkspaceAdministrationRoleApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/roles/reassign`,
      Object.freeze({
        targetUserIdentityId: request.targetUserIdentityId,
        fromRole: request.fromRole,
        toRole: request.toRole,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
      sessionToken,
    );
  }

  public async revokeWorkspaceRole(
    request: {
      readonly workspaceId: string;
      readonly targetUserIdentityId: string;
      readonly role: "owner" | "admin" | "member" | "viewer";
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<WorkspaceAdministrationApiResponse<RevokeWorkspaceAdministrationRoleApiResponse>> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/roles/revoke`,
      Object.freeze({
        targetUserIdentityId: request.targetUserIdentityId,
        role: request.role,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
      sessionToken,
    );
  }

  private async get<TResponse extends { readonly ok: boolean }>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("GET", path, sessionToken);
  }

  private async post<TResponse extends { readonly ok: boolean }>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken: string,
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", path, sessionToken, body);
  }

  private async patch<TResponse extends { readonly ok: boolean }>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken: string,
  ): Promise<TResponse> {
    return this.request<TResponse>("PATCH", path, sessionToken, body);
  }

  private async delete<TResponse extends { readonly ok: boolean }>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("DELETE", path, sessionToken);
  }

  private async request<TResponse extends { readonly ok: boolean }>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    sessionToken: string,
    body?: Readonly<Record<string, unknown>>,
  ): Promise<TResponse> {
    return await this.apiClient.requestJson<TResponse>({
      method,
      path,
      sessionToken,
      body,
    });
  }
}


