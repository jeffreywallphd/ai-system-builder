import {
  PermissionEffects,
  PermissionGrantScopes,
  PolicyDecisionOutcomes,
  ResourceVisibilities,
  RoleAssignmentScopes,
  RoleAssignmentStatuses,
  SharingSubjectKinds,
  createPolicyDecision,
  type PermissionGrant,
  type PermissionKey,
  type PolicyDecision,
  type RoleAssignment,
  type SharingGrant,
} from "../../../domain/authorization/AuthorizationDomain";
import {
  AuthorizationRoleCatalog,
  type AuthorizationRoleCatalog as AuthorizationRoleCatalogContract,
  type WorkspaceAuthorizationRoleKey,
  isWorkspaceAuthorizationRoleKey,
} from "../../../domain/authorization/AuthorizationRoleDefinitions";
import type {
  AuthorizationPolicyEvaluatorRequest,
  AuthorizationPolicyEvaluatorResult,
} from "../contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyEvaluator } from "../ports/IAuthorizationPolicyEvaluator";

export const EffectivePermissionResolutionSourceKinds = Object.freeze({
  explicitDeny: "explicit-deny",
  ownerOverride: "owner-override",
  roleGrant: "role-grant",
  permissionGrant: "permission-grant",
  sharingGrant: "sharing-grant",
  visibilityRule: "visibility-rule",
  none: "none",
});

export type EffectivePermissionResolutionSourceKind =
  typeof EffectivePermissionResolutionSourceKinds[keyof typeof EffectivePermissionResolutionSourceKinds];

export interface EffectivePermissionResolution {
  readonly decision: PolicyDecision;
  readonly sourceKind: EffectivePermissionResolutionSourceKind;
}

export interface ResolveEffectivePermissionsRequest {
  readonly actor: AuthorizationPolicyEvaluatorRequest["actor"];
  readonly resource: AuthorizationPolicyEvaluatorRequest["resource"];
  readonly permissionKeys: ReadonlyArray<PermissionKey>;
  readonly asOf?: string;
}

export interface IEffectivePermissionResolutionService {
  resolvePermission(
    request: AuthorizationPolicyEvaluatorRequest,
  ): EffectivePermissionResolution;

  resolvePermissions(
    request: ResolveEffectivePermissionsRequest,
  ): ReadonlyArray<EffectivePermissionResolution>;
}

export interface EffectivePermissionResolutionClock {
  now(): Date;
}

export interface EffectivePermissionResolutionServiceDependencies {
  readonly roleCatalog?: AuthorizationRoleCatalogContract;
  readonly clock?: EffectivePermissionResolutionClock;
}

const VisibilityReadableActions = new Set<string>(["read", "list"]);

export class EffectivePermissionResolutionService
  implements IAuthorizationPolicyEvaluator, IEffectivePermissionResolutionService {
  private readonly roleCatalog: AuthorizationRoleCatalogContract;
  private readonly clock: EffectivePermissionResolutionClock;

  public constructor(dependencies?: EffectivePermissionResolutionServiceDependencies) {
    this.roleCatalog = dependencies?.roleCatalog ?? AuthorizationRoleCatalog;
    this.clock = dependencies?.clock ?? {
      now: () => new Date(),
    };
  }

  public async evaluatePolicy(
    request: AuthorizationPolicyEvaluatorRequest,
  ): Promise<AuthorizationPolicyEvaluatorResult> {
    return {
      decision: this.resolvePermission(request).decision,
    };
  }

  public resolvePermission(
    request: AuthorizationPolicyEvaluatorRequest,
  ): EffectivePermissionResolution {
    const evaluationInstant = toEvaluationInstant(request.asOf, this.clock.now());
    const requiredPermissionKey = request.requiredPermissionKey;

    const applicableRoleAssignments = request.actor.roleAssignments.filter((assignment) => (
      isRoleAssignmentActiveAt(assignment, evaluationInstant)
      && this.matchesRoleAssignmentScope(assignment, request.resource)
    ));

    const matchingPermissionGrants = request.actor.permissionGrants.filter((grant) => (
      isPermissionGrantActiveAt(grant, evaluationInstant)
      && this.matchesPermissionGrantScope(grant, request.resource)
      && grant.permissionKey === requiredPermissionKey
    ));

    const deniedPermissionGrantIds = matchingPermissionGrants
      .filter((grant) => grant.effect === PermissionEffects.deny)
      .map((grant) => grant.id);

    if (deniedPermissionGrantIds.length > 0) {
      return this.toResolution(
        requiredPermissionKey,
        request.asOf,
        PolicyDecisionOutcomes.deny,
        EffectivePermissionResolutionSourceKinds.explicitDeny,
        "explicit-deny-permission-grant",
        "An explicit deny permission grant matched the requested permission.",
        {
          matchedPermissionGrantIds: deniedPermissionGrantIds,
        },
      );
    }

    const isOwner = !!request.actor.actorUserIdentityId
      && request.actor.actorUserIdentityId === request.resource.ownerUserIdentityId;

    if (isOwner) {
      return this.toResolution(
        requiredPermissionKey,
        request.asOf,
        PolicyDecisionOutcomes.allow,
        EffectivePermissionResolutionSourceKinds.ownerOverride,
        "owner-override",
        "The actor owns the resource and owner override applies.",
      );
    }

    const matchedRoleAssignmentIds = applicableRoleAssignments
      .filter((assignment) => this.roleAssignmentGrantsPermission(assignment, requiredPermissionKey))
      .map((assignment) => assignment.id);

    if (matchedRoleAssignmentIds.length > 0) {
      return this.toResolution(
        requiredPermissionKey,
        request.asOf,
        PolicyDecisionOutcomes.allow,
        EffectivePermissionResolutionSourceKinds.roleGrant,
        "matched-role-grant",
        "A matching active role assignment grants the requested permission.",
        {
          matchedRoleAssignmentIds,
        },
      );
    }

    const allowedPermissionGrantIds = matchingPermissionGrants
      .filter((grant) => grant.effect === PermissionEffects.allow)
      .map((grant) => grant.id);

    if (allowedPermissionGrantIds.length > 0) {
      return this.toResolution(
        requiredPermissionKey,
        request.asOf,
        PolicyDecisionOutcomes.allow,
        EffectivePermissionResolutionSourceKinds.permissionGrant,
        "matched-permission-grant",
        "An explicit allow permission grant matched the requested permission.",
        {
          matchedPermissionGrantIds: allowedPermissionGrantIds,
        },
      );
    }

    const matchedSharingGrantIds = request.resource.sharingGrants
      .filter((grant) => isSharingGrantActiveAt(grant, evaluationInstant))
      .filter((grant) => grant.permissions.includes(requiredPermissionKey))
      .filter((grant) => this.matchesSharingSubject(grant, request, applicableRoleAssignments))
      .map((grant) => grant.id);

    if (matchedSharingGrantIds.length > 0) {
      return this.toResolution(
        requiredPermissionKey,
        request.asOf,
        PolicyDecisionOutcomes.allow,
        EffectivePermissionResolutionSourceKinds.sharingGrant,
        "matched-sharing-grant",
        "A matching explicit sharing grant includes the requested permission.",
        {
          matchedSharingGrantIds,
        },
      );
    }

    const action = toPermissionAction(requiredPermissionKey);
    if (VisibilityReadableActions.has(action)) {
      if (
        request.resource.visibility === ResourceVisibilities.workspace
        && !!request.resource.workspaceId
        && hasWorkspaceMembershipContext(applicableRoleAssignments, request.resource.workspaceId)
      ) {
        return this.toResolution(
          requiredPermissionKey,
          request.asOf,
          PolicyDecisionOutcomes.allow,
          EffectivePermissionResolutionSourceKinds.visibilityRule,
          "visibility-workspace-member",
          "Workspace visibility allows read/list for active workspace members.",
        );
      }

      if (request.resource.visibility === ResourceVisibilities.published) {
        return this.toResolution(
          requiredPermissionKey,
          request.asOf,
          PolicyDecisionOutcomes.allow,
          EffectivePermissionResolutionSourceKinds.visibilityRule,
          "visibility-published",
          "Published visibility allows read/list access.",
        );
      }
    }

    return this.toResolution(
      requiredPermissionKey,
      request.asOf,
      PolicyDecisionOutcomes.deny,
      EffectivePermissionResolutionSourceKinds.none,
      "no-effective-permission",
      "No role grant, owner override, sharing grant, or visibility rule allowed the permission.",
    );
  }

  public resolvePermissions(
    request: ResolveEffectivePermissionsRequest,
  ): ReadonlyArray<EffectivePermissionResolution> {
    const dedupedPermissionKeys = [...new Set(request.permissionKeys)];
    return Object.freeze(dedupedPermissionKeys.map((permissionKey) => this.resolvePermission({
      actor: request.actor,
      resource: request.resource,
      requiredPermissionKey: permissionKey,
      asOf: request.asOf,
    })));
  }

  private roleAssignmentGrantsPermission(
    assignment: RoleAssignment,
    requiredPermissionKey: PermissionKey,
  ): boolean {
    if (!isWorkspaceAuthorizationRoleKey(assignment.roleKey)) {
      return false;
    }

    const roleDefinition = this.roleCatalog.roleDefinitions[assignment.roleKey as WorkspaceAuthorizationRoleKey];
    if (!roleDefinition) {
      return false;
    }

    return roleDefinition.baselinePermissionKeys.includes(requiredPermissionKey);
  }

  private matchesRoleAssignmentScope(
    assignment: RoleAssignment,
    resource: AuthorizationPolicyEvaluatorRequest["resource"],
  ): boolean {
    if (assignment.scope === RoleAssignmentScopes.global) {
      return true;
    }

    if (assignment.scope === RoleAssignmentScopes.workspace) {
      return !!resource.workspaceId && assignment.workspaceId === resource.workspaceId;
    }

    return assignment.resourceType === resource.resourceType
      && assignment.resourceId === resource.resourceId;
  }

  private matchesPermissionGrantScope(
    grant: PermissionGrant,
    resource: AuthorizationPolicyEvaluatorRequest["resource"],
  ): boolean {
    if (grant.scope === PermissionGrantScopes.global) {
      return true;
    }

    if (grant.scope === PermissionGrantScopes.workspace) {
      return !!resource.workspaceId && grant.workspaceId === resource.workspaceId;
    }

    return grant.resourceType === resource.resourceType
      && grant.resourceId === resource.resourceId;
  }

  private matchesSharingSubject(
    sharingGrant: SharingGrant,
    request: AuthorizationPolicyEvaluatorRequest,
    applicableRoleAssignments: ReadonlyArray<RoleAssignment>,
  ): boolean {
    const subject = sharingGrant.subject;

    if (subject.kind === SharingSubjectKinds.user) {
      return !!request.actor.actorUserIdentityId
        && request.actor.actorUserIdentityId === subject.userIdentityId;
    }

    if (subject.kind === SharingSubjectKinds.workspace) {
      return hasWorkspaceMembershipContext(applicableRoleAssignments, subject.workspaceId);
    }

    if (subject.kind === SharingSubjectKinds.workspaceRole) {
      return applicableRoleAssignments.some((assignment) => (
        assignment.scope === RoleAssignmentScopes.workspace
        && assignment.workspaceId === subject.workspaceId
        && assignment.roleKey === subject.roleKey
      ));
    }

    return request.resource.visibility === ResourceVisibilities.published;
  }

  private toResolution(
    requiredPermissionKey: PermissionKey,
    asOf: string | undefined,
    outcome: PolicyDecision["outcome"],
    sourceKind: EffectivePermissionResolutionSourceKind,
    reasonCode: string,
    reason: string,
    matched?: {
      readonly matchedRoleAssignmentIds?: ReadonlyArray<string>;
      readonly matchedPermissionGrantIds?: ReadonlyArray<string>;
      readonly matchedSharingGrantIds?: ReadonlyArray<string>;
    },
  ): EffectivePermissionResolution {
    return Object.freeze({
      sourceKind,
      decision: createPolicyDecision({
        outcome,
        requiredPermissionKey,
        reasonCode,
        reason,
        evaluatedAt: asOf ?? this.clock.now(),
        matchedRoleAssignmentIds: matched?.matchedRoleAssignmentIds,
        matchedPermissionGrantIds: matched?.matchedPermissionGrantIds,
        matchedSharingGrantIds: matched?.matchedSharingGrantIds,
      }),
    });
  }
}

function toEvaluationInstant(asOf: string | undefined, fallback: Date): Date {
  const normalizedAsOf = asOf?.trim();
  if (!normalizedAsOf) {
    return fallback;
  }

  const parsed = new Date(normalizedAsOf);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function isRoleAssignmentActiveAt(roleAssignment: RoleAssignment, asOf: Date): boolean {
  if (roleAssignment.status !== RoleAssignmentStatuses.active) {
    return false;
  }

  const asOfEpoch = asOf.getTime();
  if (Date.parse(roleAssignment.assignedAt) > asOfEpoch) {
    return false;
  }

  if (roleAssignment.revokedAt && Date.parse(roleAssignment.revokedAt) <= asOfEpoch) {
    return false;
  }

  return true;
}

function isPermissionGrantActiveAt(permissionGrant: PermissionGrant, asOf: Date): boolean {
  const asOfEpoch = asOf.getTime();
  if (Date.parse(permissionGrant.grantedAt) > asOfEpoch) {
    return false;
  }

  if (permissionGrant.revokedAt && Date.parse(permissionGrant.revokedAt) <= asOfEpoch) {
    return false;
  }

  if (permissionGrant.expiresAt && Date.parse(permissionGrant.expiresAt) <= asOfEpoch) {
    return false;
  }

  return true;
}

function isSharingGrantActiveAt(sharingGrant: SharingGrant, asOf: Date): boolean {
  const asOfEpoch = asOf.getTime();
  if (Date.parse(sharingGrant.grantedAt) > asOfEpoch) {
    return false;
  }

  if (sharingGrant.revokedAt && Date.parse(sharingGrant.revokedAt) <= asOfEpoch) {
    return false;
  }

  if (sharingGrant.expiresAt && Date.parse(sharingGrant.expiresAt) <= asOfEpoch) {
    return false;
  }

  return true;
}

function hasWorkspaceMembershipContext(
  roleAssignments: ReadonlyArray<RoleAssignment>,
  workspaceId: string,
): boolean {
  return roleAssignments.some((assignment) => (
    assignment.scope === RoleAssignmentScopes.global
    || (assignment.scope === RoleAssignmentScopes.workspace && assignment.workspaceId === workspaceId)
  ));
}

function toPermissionAction(permissionKey: PermissionKey): string {
  const segments = permissionKey.split(".");
  const action = segments[segments.length - 1] ?? permissionKey;
  return action.trim().toLowerCase();
}
