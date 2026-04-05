import type {
  ActorContext,
  PermissionGrant,
  PermissionKey,
  PolicyDecision,
  ResourceOwnershipScope,
  ResourcePolicyContext,
  ResourceVisibility,
  RoleAssignment,
  SharingPolicyMode,
  SharingSubject,
} from "../../../domain/authorization/AuthorizationDomain";
import type {
  AuthorizationResourceFamily,
} from "../../../domain/authorization/AuthorizationPermissionCatalog";

export interface AuthorizationActorReference {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly activeWorkspaceId?: string;
  readonly authenticatedAt?: string;
}

export interface AuthorizationResourceReference {
  readonly resourceFamily: AuthorizationResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}

export interface AuthorizationActorMembershipLookupQuery {
  readonly actorUserIdentityId: string;
  readonly workspaceId?: string;
  readonly asOf?: string;
  readonly includeInactive?: boolean;
}

export interface AuthorizationActorMembershipRecord {
  readonly workspaceId: string;
  readonly userIdentityId: string;
  readonly status: string;
  readonly joinedAt?: string;
  readonly suspendedAt?: string;
  readonly removedAt?: string;
}

export interface AuthorizationActorRoleGrantSnapshotQuery {
  readonly actor: AuthorizationActorReference;
  readonly resource?: AuthorizationResourceReference;
  readonly asOf?: string;
}

export interface AuthorizationActorRoleGrantSnapshot {
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants: ReadonlyArray<PermissionGrant>;
}

export interface AuthorizationResourcePolicyMetadataLookupQuery {
  readonly resource: AuthorizationResourceReference;
  readonly asOf?: string;
}

export interface AuthorizationResourcePolicyMetadata {
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
}

export interface AuthorizationSharingGrantLookupQuery {
  readonly resource: AuthorizationResourceReference;
  readonly asOf?: string;
}

export interface AuthorizationSharingGrantRecord {
  readonly id: string;
  readonly subject: SharingSubject;
  readonly permissionKeys: ReadonlyArray<PermissionKey>;
  readonly grantedByUserIdentityId: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
}

export interface AuthorizationPolicyEvaluationRequestDto {
  readonly actor: AuthorizationActorReference;
  readonly resource: AuthorizationResourceReference;
  readonly requiredPermissionKey: PermissionKey;
  readonly asOf?: string;
  readonly correlationId?: string;
}

export interface AuthorizationPolicyEvaluatorRequest {
  readonly actor: ActorContext;
  readonly resource: ResourcePolicyContext;
  readonly requiredPermissionKey: PermissionKey;
  readonly asOf?: string;
}

export interface AuthorizationPolicyEvaluatorResult {
  readonly decision: PolicyDecision;
}

export interface AuthorizationPolicyEvaluationResolvedContext {
  readonly actorMemberships: ReadonlyArray<AuthorizationActorMembershipRecord>;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants: ReadonlyArray<PermissionGrant>;
  readonly resourcePolicyMetadata: AuthorizationResourcePolicyMetadata;
  readonly sharingGrants: ReadonlyArray<AuthorizationSharingGrantRecord>;
}

export interface AuthorizationPolicyEvaluationDecisionDto {
  readonly decision: PolicyDecision;
  readonly resolvedContext: AuthorizationPolicyEvaluationResolvedContext;
}

export const AuthorizationPolicyEvaluationEventTypes = Object.freeze({
  evaluated: "authorization-policy-evaluated",
});

export type AuthorizationPolicyEvaluationEventType =
  typeof AuthorizationPolicyEvaluationEventTypes[keyof typeof AuthorizationPolicyEvaluationEventTypes];

export interface AuthorizationPolicyEvaluationRecordedEvent {
  readonly type: AuthorizationPolicyEvaluationEventType;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly request: AuthorizationPolicyEvaluationRequestDto;
  readonly result: AuthorizationPolicyEvaluationDecisionDto;
}
