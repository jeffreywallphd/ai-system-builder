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
}

export interface AuthorizationAccessStateApiRequest {
  readonly actorUserIdentityId: string;
  readonly resource: AuthorizationManagedResourceRef;
  readonly asOf?: string;
  readonly includeDenied?: boolean;
  readonly includeRevokedSharingGrants?: boolean;
}

export interface AuthorizationAccessStateApiResponse {
  readonly resource: AuthorizationManagedResourceRef;
  readonly resourcePolicyMetadata: AuthorizationResourcePolicyMetadataApiRecord;
  readonly roleAssignmentIds: ReadonlyArray<string>;
  readonly directPermissionGrantIds: ReadonlyArray<string>;
  readonly sharingGrants: ReadonlyArray<AuthorizationSharingGrantApiRecord>;
  readonly permissions: ReadonlyArray<AuthorizationPermissionDecisionApiRecord>;
}
