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

export interface AuthorizationResourcePolicyMetadataListQuery {
  readonly workspaceId?: string;
  readonly ownerUserIdentityId?: string;
  readonly visibility?: ResourceVisibility;
  readonly resourceFamily?: AuthorizationResourceFamily;
  readonly resourceType?: string;
  readonly asOf?: string;
  readonly limit?: number;
  readonly offset?: number;
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

export const AuthorizationPolicyEvaluationTargetKinds = Object.freeze({
  resourceInstance: "resource-instance",
  workspaceCapability: "workspace-capability",
});

export type AuthorizationPolicyEvaluationTargetKind =
  typeof AuthorizationPolicyEvaluationTargetKinds[keyof typeof AuthorizationPolicyEvaluationTargetKinds];

export interface AuthorizationResourceInstanceEvaluationTarget {
  readonly kind: typeof AuthorizationPolicyEvaluationTargetKinds.resourceInstance;
  readonly resource: AuthorizationResourceReference;
}

export interface AuthorizationWorkspaceCapabilityEvaluationTarget {
  readonly kind: typeof AuthorizationPolicyEvaluationTargetKinds.workspaceCapability;
  readonly workspaceId: string;
  readonly capabilityResourceType: string;
}

export type AuthorizationPolicyEvaluationTarget =
  | AuthorizationResourceInstanceEvaluationTarget
  | AuthorizationWorkspaceCapabilityEvaluationTarget;

export const AuthorizationPolicyDecisionDenialReasons = Object.freeze({
  resourcePolicyMetadataNotFound: "resource-policy-metadata-not-found",
  explicitDenyPermissionGrant: "explicit-deny-permission-grant",
  insufficientPermissions: "insufficient-permissions",
  invalidEvaluationContext: "invalid-evaluation-context",
});

export type AuthorizationPolicyDecisionDenialReason =
  typeof AuthorizationPolicyDecisionDenialReasons[keyof typeof AuthorizationPolicyDecisionDenialReasons];

export interface AuthorizationPolicyDecisionDebugDetails {
  readonly targetKind: AuthorizationPolicyEvaluationTargetKind;
  readonly sourceKind: string;
  readonly roleAssignmentCount: number;
  readonly permissionGrantCount: number;
  readonly sharingGrantCount: number;
}

export interface AuthorizationPolicyDecision {
  readonly isAllowed: boolean;
  readonly outcome: Extract<PolicyDecision["outcome"], "allow" | "deny">;
  readonly requiredPermissionKey: PermissionKey;
  readonly reasonCode: string;
  readonly reason: string;
  readonly denialReason?: AuthorizationPolicyDecisionDenialReason;
  readonly evaluatedAt: string;
  readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
  readonly matchedPermissionGrantIds: ReadonlyArray<string>;
  readonly matchedSharingGrantIds: ReadonlyArray<string>;
}

export interface AuthorizationPolicyDecisionEvaluationRequest {
  readonly actor: AuthorizationActorReference;
  readonly requiredPermissionKey: PermissionKey;
  readonly target: AuthorizationPolicyEvaluationTarget;
  readonly asOf?: string;
  readonly includeDebugDetails?: boolean;
}

export interface AuthorizationPolicyDecisionEvaluationResult {
  readonly decision: AuthorizationPolicyDecision;
  readonly debug?: AuthorizationPolicyDecisionDebugDetails;
}

export const AuthorizationPolicyEvaluationEventTypes = Object.freeze({
  evaluated: "authorization-policy-evaluated",
  denied: "authorization-policy-denied",
  roleAssignmentUpserted: "authorization-role-assignment-upserted",
  roleAssignmentRevoked: "authorization-role-assignment-revoked",
  sharingGrantUpserted: "authorization-sharing-grant-upserted",
  sharingGrantRevoked: "authorization-sharing-grant-revoked",
  resourcePolicyUpserted: "authorization-resource-policy-upserted",
  resourcePolicySoftDeleted: "authorization-resource-policy-soft-deleted",
});

export type AuthorizationPolicyEvaluationEventType =
  | typeof AuthorizationPolicyEvaluationEventTypes.evaluated
  | typeof AuthorizationPolicyEvaluationEventTypes.denied;

export interface AuthorizationPolicyAuditActor {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
}

export interface AuthorizationPolicyAuditResource {
  readonly resourceFamily?: AuthorizationResourceFamily;
  readonly resourceType?: string;
  readonly resourceId?: string;
}

export interface AuthorizationPolicyEvaluationRecordedEvent {
  readonly type: AuthorizationPolicyEvaluationEventType;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly actor: AuthorizationPolicyAuditActor;
  readonly workspaceId?: string;
  readonly resource?: AuthorizationPolicyAuditResource;
  readonly requiredPermissionKey: PermissionKey;
  readonly outcome: AuthorizationPolicyDecision["outcome"];
  readonly reasonCode: string;
  readonly denialReason?: AuthorizationPolicyDecisionDenialReason;
  readonly roleAssignmentCount: number;
  readonly permissionGrantCount: number;
  readonly sharingGrantCount: number;
}

export interface AuthorizationPolicyDeniedRecordedEvent extends AuthorizationPolicyEvaluationRecordedEvent {
  readonly type: typeof AuthorizationPolicyEvaluationEventTypes.denied;
}

export interface AuthorizationPolicyMutationRecordedEvent {
  readonly type: AuthorizationPolicyMutationEventType;
  readonly occurredAt: string;
  readonly correlationId?: string;
  readonly actor: AuthorizationPolicyAuditActor;
  readonly workspaceId?: string;
  readonly resource?: AuthorizationPolicyAuditResource;
  readonly mutation: Readonly<{
    entityKind: "role-assignment" | "sharing-grant" | "resource-policy";
    mutationKind: "upsert" | "revoke" | "soft-delete";
    operationKey: string;
    expectedRevision?: number;
    changed: boolean;
    wasReplay: boolean;
  }>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type AuthorizationPolicyMutationEventType =
  | typeof AuthorizationPolicyEvaluationEventTypes.roleAssignmentUpserted
  | typeof AuthorizationPolicyEvaluationEventTypes.roleAssignmentRevoked
  | typeof AuthorizationPolicyEvaluationEventTypes.sharingGrantUpserted
  | typeof AuthorizationPolicyEvaluationEventTypes.sharingGrantRevoked
  | typeof AuthorizationPolicyEvaluationEventTypes.resourcePolicyUpserted
  | typeof AuthorizationPolicyEvaluationEventTypes.resourcePolicySoftDeleted;

export type AuthorizationPolicyRecordedEvent =
  | AuthorizationPolicyEvaluationRecordedEvent
  | AuthorizationPolicyDeniedRecordedEvent
  | AuthorizationPolicyMutationRecordedEvent;
