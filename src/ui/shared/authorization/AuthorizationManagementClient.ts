import type {
  AuthorizationAccessStateApiResponse,
  AuthorizationManagementApiResponse,
  AuthorizationWorkspaceSharingReportApiResponse,
  GrantAuthorizationSharingAccessApiResponse,
  RevokeAuthorizationSharingAccessApiResponse,
  UpdateAuthorizationVisibilityApiResponse,
} from "@infrastructure/api/authorization/sdk/PublicAuthorizationManagementApiContract";
import type { AuthorizationResourceFamily } from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  AuthorizationRoleKey,
  ResourceVisibility,
  SharingPolicyMode,
} from "@domain/authorization/AuthorizationDomain";

export type AuthorizationSharingTargetDraft =
  | Readonly<{
    kind: "user";
    userId: string;
  }>
  | Readonly<{
    kind: "workspace-role";
    workspaceId: string;
    roleKey: AuthorizationRoleKey;
  }>
  | Readonly<{
    kind: "workspace";
    workspaceId: string;
  }>
  | Readonly<{
    kind: "public";
  }>;

export interface AuthorizationManagementClient {
  readAccessState(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly inspectedActorUserIdentityId?: string;
      readonly asOf?: string;
      readonly includeDenied?: boolean;
      readonly includeRevokedSharingGrants?: boolean;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<AuthorizationAccessStateApiResponse>>;
  readWorkspaceSharingReport(
    request: {
      readonly workspaceId: string;
      readonly asOf?: string;
      readonly includeRevokedRoleAssignments?: boolean;
      readonly includeRevokedSharingGrants?: boolean;
      readonly recentSharingMutationsLimit?: number;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<AuthorizationWorkspaceSharingReportApiResponse>>;
  updateVisibility(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly workspaceId?: string;
      readonly visibility: ResourceVisibility;
      readonly sharingPolicyMode: SharingPolicyMode;
      readonly allowResharing?: boolean;
      readonly isPublishedCapable?: boolean;
      readonly publishedAt?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<UpdateAuthorizationVisibilityApiResponse>>;
  grantSharingAccess(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly workspaceId?: string;
      readonly visibility?: ResourceVisibility;
      readonly expectedRevision?: number;
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly grant: Readonly<{
        id: string;
        target: AuthorizationSharingTargetDraft;
        permissionKeys: ReadonlyArray<string>;
      }>;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<GrantAuthorizationSharingAccessApiResponse>>;
  revokeSharingAccess(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly grantId: string;
      readonly workspaceId?: string;
      readonly visibility?: ResourceVisibility;
      readonly expectedRevision?: number;
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<RevokeAuthorizationSharingAccessApiResponse>>;
}

export class HttpAuthorizationManagementClient implements AuthorizationManagementClient {
  private readonly baseUrl: string;

  public constructor(baseUrl: string) {
    const normalized = baseUrl.trim();
    this.baseUrl = normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
  }

  public async readAccessState(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly inspectedActorUserIdentityId?: string;
      readonly asOf?: string;
      readonly includeDenied?: boolean;
      readonly includeRevokedSharingGrants?: boolean;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<AuthorizationAccessStateApiResponse>> {
    const query = new URLSearchParams();
    if (request.inspectedActorUserIdentityId) {
      query.set("inspectedActorUserIdentityId", request.inspectedActorUserIdentityId);
    }
    if (request.asOf) {
      query.set("asOf", request.asOf);
    }
    if (typeof request.includeDenied === "boolean") {
      query.set("includeDenied", request.includeDenied ? "true" : "false");
    }
    if (typeof request.includeRevokedSharingGrants === "boolean") {
      query.set("includeRevokedSharingGrants", request.includeRevokedSharingGrants ? "true" : "false");
    }

    return this.get(
      `${toResourcePath(request.resourceFamily, request.resourceType, request.resourceId)}/access-state${toQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async readWorkspaceSharingReport(
    request: {
      readonly workspaceId: string;
      readonly asOf?: string;
      readonly includeRevokedRoleAssignments?: boolean;
      readonly includeRevokedSharingGrants?: boolean;
      readonly recentSharingMutationsLimit?: number;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<AuthorizationWorkspaceSharingReportApiResponse>> {
    const query = new URLSearchParams();
    if (request.asOf) {
      query.set("asOf", request.asOf);
    }
    if (typeof request.includeRevokedRoleAssignments === "boolean") {
      query.set("includeRevokedRoleAssignments", request.includeRevokedRoleAssignments ? "true" : "false");
    }
    if (typeof request.includeRevokedSharingGrants === "boolean") {
      query.set("includeRevokedSharingGrants", request.includeRevokedSharingGrants ? "true" : "false");
    }
    if (typeof request.recentSharingMutationsLimit === "number") {
      query.set("recentSharingMutationsLimit", request.recentSharingMutationsLimit.toString(10));
    }

    return this.get(
      `/api/v1/authorization/reporting/workspaces/${encodeURIComponent(request.workspaceId)}${toQuerySuffix(query)}`,
      sessionToken,
    );
  }

  public async updateVisibility(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly workspaceId?: string;
      readonly visibility: ResourceVisibility;
      readonly sharingPolicyMode: SharingPolicyMode;
      readonly allowResharing?: boolean;
      readonly isPublishedCapable?: boolean;
      readonly publishedAt?: string;
      readonly expectedRevision?: number;
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<UpdateAuthorizationVisibilityApiResponse>> {
    return this.patch(
      `${toResourcePath(request.resourceFamily, request.resourceType, request.resourceId)}/visibility`,
      Object.freeze({
        workspaceId: request.workspaceId,
        visibility: request.visibility,
        sharingPolicyMode: request.sharingPolicyMode,
        allowResharing: request.allowResharing,
        isPublishedCapable: request.isPublishedCapable,
        publishedAt: request.publishedAt,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
      sessionToken,
    );
  }

  public async grantSharingAccess(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly workspaceId?: string;
      readonly visibility?: ResourceVisibility;
      readonly expectedRevision?: number;
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
      readonly grant: Readonly<{
        id: string;
        target: AuthorizationSharingTargetDraft;
        permissionKeys: ReadonlyArray<string>;
      }>;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<GrantAuthorizationSharingAccessApiResponse>> {
    return this.post(
      `${toResourcePath(request.resourceFamily, request.resourceType, request.resourceId)}/sharing-grants`,
      Object.freeze({
        workspaceId: request.workspaceId,
        visibility: request.visibility,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
        grant: request.grant,
      }),
      sessionToken,
    );
  }

  public async revokeSharingAccess(
    request: {
      readonly resourceFamily: AuthorizationResourceFamily;
      readonly resourceType: string;
      readonly resourceId: string;
      readonly grantId: string;
      readonly workspaceId?: string;
      readonly visibility?: ResourceVisibility;
      readonly expectedRevision?: number;
      readonly reason?: string;
      readonly correlationId?: string;
      readonly metadata?: Readonly<Record<string, unknown>>;
    },
    sessionToken: string,
  ): Promise<AuthorizationManagementApiResponse<RevokeAuthorizationSharingAccessApiResponse>> {
    return this.delete(
      `${toResourcePath(request.resourceFamily, request.resourceType, request.resourceId)}/sharing-grants/${encodeURIComponent(request.grantId)}`,
      sessionToken,
      Object.freeze({
        workspaceId: request.workspaceId,
        visibility: request.visibility,
        expectedRevision: request.expectedRevision,
        reason: request.reason,
        correlationId: request.correlationId,
        metadata: request.metadata,
      }),
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

  private async delete<TResponse>(
    path: string,
    sessionToken: string,
    body?: Readonly<Record<string, unknown>>,
  ): Promise<TResponse> {
    return this.request<TResponse>("DELETE", path, sessionToken, body);
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

function toResourcePath(resourceFamily: string, resourceType: string, resourceId: string): string {
  return `/api/v1/authorization/resources/${encodeURIComponent(resourceFamily)}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`;
}

function toQuerySuffix(query: URLSearchParams): string {
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

