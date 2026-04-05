import type { AuthorizationResourceFamily, CatalogPermissionKey } from "../../../../src/domain/authorization/AuthorizationPermissionCatalog";
import type { AuthorizationRoleKey, ResourceOwnershipScope, ResourceVisibility, SharingPolicyMode } from "../../../../src/domain/authorization/AuthorizationDomain";

export const AuthorizationManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  internal: "internal",
} as const);

export type AuthorizationManagementApiErrorCode =
  typeof AuthorizationManagementApiErrorCodes[keyof typeof AuthorizationManagementApiErrorCodes];

export interface AuthorizationManagementApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface AuthorizationManagementApiError {
  readonly code: AuthorizationManagementApiErrorCode;
  readonly message: string;
  readonly reasonCode?: string;
  readonly validationErrors?: ReadonlyArray<AuthorizationManagementApiValidationError>;
}

export interface AuthorizationManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: AuthorizationManagementApiError;
}

export interface AuthorizationManagedResourceRef {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}

export type AuthorizationSharingTargetApiRecord =
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

export interface AuthorizationSharingGrantApiRecord {
  readonly grantId: string;
  readonly target: AuthorizationSharingTargetApiRecord;
  readonly permissionKeys: ReadonlyArray<string>;
  readonly grantedAt: string;
  readonly grantedByUserIdentityId: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly revision: number;
}

export interface AuthorizationResourcePolicyMetadataApiRecord {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerUserIdentityId: string;
  readonly ownershipScope: ResourceOwnershipScope;
  readonly workspaceId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly allowResharing: boolean;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
  readonly revision: number;
}

export interface UpdateAuthorizationVisibilityApiRequest {
  readonly actorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly workspaceId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly allowResharing?: boolean;
  readonly sharingGrants?: ReadonlyArray<Readonly<{
    id: string;
    target: AuthorizationSharingTargetApiRecord;
    permissionKeys: ReadonlyArray<string>;
  }>>;
  readonly isPublishedCapable?: boolean;
  readonly publishedAt?: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateAuthorizationVisibilityApiResponse {
  readonly metadata: AuthorizationResourcePolicyMetadataApiRecord;
  readonly metadataChanged: boolean;
  readonly sharingGrantMutations: ReadonlyArray<Readonly<{
    grantId: string;
    changed: boolean;
    revokedAt?: string;
  }>>;
}

export interface GrantAuthorizationSharingAccessApiRequest {
  readonly actorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly workspaceId?: string;
  readonly visibility?: ResourceVisibility;
  readonly grant: Readonly<{
    id: string;
    target: AuthorizationSharingTargetApiRecord;
    permissionKeys: ReadonlyArray<string>;
  }>;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GrantAuthorizationSharingAccessApiResponse {
  readonly grant: AuthorizationSharingGrantApiRecord;
  readonly changed: boolean;
}

export interface RevokeAuthorizationSharingAccessApiRequest {
  readonly actorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly workspaceId?: string;
  readonly visibility?: ResourceVisibility;
  readonly grantId: string;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface RevokeAuthorizationSharingAccessApiResponse {
  readonly grant: AuthorizationSharingGrantApiRecord;
  readonly changed: boolean;
}

export interface BulkGrantAuthorizationWorkspaceRoleAccessApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly resources: ReadonlyArray<AuthorizationManagedResourceRef>;
  readonly permissionKeys: ReadonlyArray<string>;
  readonly reason?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type BulkGrantAuthorizationWorkspaceRoleAccessApiResultItem =
  | Readonly<{
    resource: AuthorizationManagedResourceRef;
    status: "created" | "updated" | "unchanged";
    grantId: string;
    changed: boolean;
    revision: number;
  }>
  | Readonly<{
    resource: AuthorizationManagedResourceRef;
    status: "failed";
    error: Readonly<{
      code: string;
      message: string;
      reasonCode?: string;
    }>;
  }>;

export interface BulkGrantAuthorizationWorkspaceRoleAccessApiResponse {
  readonly workspaceId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly permissionKeys: ReadonlyArray<string>;
  readonly totalResources: number;
  readonly succeededResources: number;
  readonly failedResources: number;
  readonly results: ReadonlyArray<BulkGrantAuthorizationWorkspaceRoleAccessApiResultItem>;
}

export interface AuthorizationPermissionDecisionApiRecord {
  readonly permissionKey: CatalogPermissionKey;
  readonly isAllowed: boolean;
  readonly outcome: "allow" | "deny";
  readonly reasonCode: string;
  readonly reason: string;
  readonly denialReason?: string;
  readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
  readonly matchedPermissionGrantIds: ReadonlyArray<string>;
  readonly matchedSharingGrantIds: ReadonlyArray<string>;
  readonly explanation: Readonly<{
    readonly ownershipContext: Readonly<{
      readonly isResourceOwner: boolean;
      readonly contributedToDecision: boolean;
    }>;
    readonly roleBasedGrants: Readonly<{
      readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
      readonly contributedToDecision: boolean;
    }>;
    readonly directPermissionGrants: Readonly<{
      readonly matchedPermissionGrantIds: ReadonlyArray<string>;
      readonly contributedToDecision: boolean;
    }>;
    readonly sharingBasedGrants: Readonly<{
      readonly matchedSharingGrantIds: ReadonlyArray<string>;
      readonly contributedToDecision: boolean;
    }>;
    readonly visibilityContribution: Readonly<{
      readonly resourceVisibility: ResourceVisibility;
      readonly sharingPolicyMode: SharingPolicyMode;
      readonly contributedToDecision: boolean;
      readonly contributionReasonCode?: string;
    }>;
  }>;
}

export interface AuthorizationAccessStateApiRequest {
  readonly actorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly inspectedActorUserIdentityId?: string;
  readonly asOf?: string;
  readonly includeDenied?: boolean;
  readonly includeRevokedSharingGrants?: boolean;
}

export interface AuthorizationAccessStateApiResponse {
  readonly inspectorActorUserIdentityId: string;
  readonly inspectedActorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly resourcePolicyMetadata: AuthorizationResourcePolicyMetadataApiRecord;
  readonly roleAssignmentIds: ReadonlyArray<string>;
  readonly directPermissionGrantIds: ReadonlyArray<string>;
  readonly sharingGrants: ReadonlyArray<AuthorizationSharingGrantApiRecord>;
  readonly permissions: ReadonlyArray<AuthorizationPermissionDecisionApiRecord>;
}

export interface AuthorizationWorkspaceRoleAssignmentReportApiRecord {
  readonly roleAssignmentId: string;
  readonly actorUserIdentityId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly scope: "global" | "workspace" | "resource";
  readonly status: "active" | "revoked";
  readonly workspaceId?: string;
  readonly resourceFamily?: AuthorizationResourceFamily;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly assignedAt: string;
  readonly assignedByUserIdentityId: string;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
}

export interface AuthorizationResourceVisibilityDistributionApiRecord {
  readonly private: number;
  readonly workspace: number;
  readonly shared: number;
  readonly published: number;
  readonly total: number;
}

export interface AuthorizationUnusualVisibilityPatternApiRecord {
  readonly resource: AuthorizationManagedResourceRef;
  readonly workspaceId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly activeSharingGrantCount: number;
  readonly reasonCodes: ReadonlyArray<
    | "private-resource-with-active-sharing-grants"
    | "owner-only-policy-with-active-sharing-grants"
    | "published-visibility-without-published-at"
  >;
}

export interface AuthorizationSharingMutationReportApiRecord {
  readonly grantId: string;
  readonly mutationType: "granted" | "revoked";
  readonly occurredAt: string;
  readonly actorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly target: AuthorizationSharingTargetApiRecord;
  readonly permissionKeys: ReadonlyArray<string>;
}

export interface AuthorizationWorkspaceSharingReportApiRequest {
  readonly actorUserIdentityId: string;
  readonly workspaceId: string;
  readonly asOf?: string;
  readonly includeRevokedRoleAssignments?: boolean;
  readonly includeRevokedSharingGrants?: boolean;
  readonly recentSharingMutationsLimit?: number;
}

export interface AuthorizationWorkspaceSharingReportApiResponse {
  readonly workspaceId: string;
  readonly asOf: string;
  readonly generatedAt: string;
  readonly roleAssignments: ReadonlyArray<AuthorizationWorkspaceRoleAssignmentReportApiRecord>;
  readonly resourceVisibilityDistribution: AuthorizationResourceVisibilityDistributionApiRecord;
  readonly unusualVisibilityPatterns: ReadonlyArray<AuthorizationUnusualVisibilityPatternApiRecord>;
  readonly recentSharingMutations: ReadonlyArray<AuthorizationSharingMutationReportApiRecord>;
}
