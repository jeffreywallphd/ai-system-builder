import type {
  AddWorkspaceAdministrationMemberApiResponse,
  AssignWorkspaceAdministrationRoleApiResponse,
  CancelWorkspaceAdministrationInvitationApiResponse,
  ChangeWorkspaceAdministrationMemberStatusApiResponse,
  CreateWorkspaceAdministrationApiResponse,
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
} from "../../../src/infrastructure/api/workspaces/sdk/PublicWorkspaceAdministrationApiContract";
import type {
  AcceptWorkspaceInvitationOnboardingApiResponse,
  IssueWorkspaceInvitationApiResponse,
  WorkspaceInvitationApiResponse,
} from "../../../src/infrastructure/api/workspaces/sdk/PublicWorkspaceInvitationApiContract";

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
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
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
    if (request.ownerUserIdentityId) {
      query.set("ownerUserIdentityId", request.ownerUserIdentityId);
    }
    if (request.statuses) {
      for (const status of request.statuses) {
        query.append("status", status);
      }
    }
    if (request.visibility) {
      query.set("visibility", request.visibility);
    }
    if (request.slugPrefix) {
      query.set("slugPrefix", request.slugPrefix);
    }
    appendPagination(query, request.limit, request.offset);
    return this.get(`/api/v1/workspaces${toQuerySuffix(query)}`, sessionToken);
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
    if (request.asOf) {
      query.set("asOf", request.asOf);
    }
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/admin-view${toQuerySuffix(query)}`,
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
    if (request.userIdentityId) {
      query.set("userIdentityId", request.userIdentityId);
    }
    if (request.statuses) {
      for (const status of request.statuses) {
        query.append("status", status);
      }
    }
    if (request.invitationId) {
      query.set("invitationId", request.invitationId);
    }
    if (request.invitedByUserIdentityId) {
      query.set("invitedByUserIdentityId", request.invitedByUserIdentityId);
    }
    appendPagination(query, request.limit, request.offset);
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/members${toQuerySuffix(query)}`,
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
    if (request.invitedEmail) {
      query.set("invitedEmail", request.invitedEmail);
    }
    if (request.invitedByUserIdentityId) {
      query.set("invitedByUserIdentityId", request.invitedByUserIdentityId);
    }
    if (request.statuses) {
      for (const status of request.statuses) {
        query.append("status", status);
      }
    }
    if (typeof request.activeOnly === "boolean") {
      query.set("activeOnly", request.activeOnly ? "true" : "false");
    }
    if (request.expiresBefore) {
      query.set("expiresBefore", request.expiresBefore);
    }
    if (request.expiresAfter) {
      query.set("expiresAfter", request.expiresAfter);
    }
    if (request.asOf) {
      query.set("asOf", request.asOf);
    }
    appendPagination(query, request.limit, request.offset);
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/invitations${toQuerySuffix(query)}`,
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
    if (request.userIdentityId) {
      query.set("userIdentityId", request.userIdentityId);
    }
    if (request.roles) {
      for (const role of request.roles) {
        query.append("role", role);
      }
    }
    if (request.statuses) {
      for (const status of request.statuses) {
        query.append("status", status);
      }
    }
    appendPagination(query, request.limit, request.offset);
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(request.workspaceId)}/roles${toQuerySuffix(query)}`,
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

  private async get<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("GET", path, sessionToken);
  }

  private async post<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken: string,
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", path, sessionToken, body);
  }

  private async patch<TResponse>(
    path: string,
    body: Readonly<Record<string, unknown>>,
    sessionToken: string,
  ): Promise<TResponse> {
    return this.request<TResponse>("PATCH", path, sessionToken, body);
  }

  private async delete<TResponse>(path: string, sessionToken: string): Promise<TResponse> {
    return this.request<TResponse>("DELETE", path, sessionToken);
  }

  private async request<TResponse>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    sessionToken: string,
    body?: Readonly<Record<string, unknown>>,
  ): Promise<TResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${sessionToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await response.json() as TResponse;
  }
}

function appendPagination(query: URLSearchParams, limit?: number, offset?: number): void {
  if (typeof limit === "number") {
    query.set("limit", String(limit));
  }
  if (typeof offset === "number") {
    query.set("offset", String(offset));
  }
}

function toQuerySuffix(query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}
