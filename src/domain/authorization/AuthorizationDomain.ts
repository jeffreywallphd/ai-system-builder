export class AuthorizationDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationDomainError";
  }
}

export const AuthorizationRoleKeys = Object.freeze({
  owner: "owner",
  admin: "admin",
  member: "member",
  viewer: "viewer",
});

export type AuthorizationRoleKey =
  typeof AuthorizationRoleKeys[keyof typeof AuthorizationRoleKeys] | string;

export const RoleAssignmentScopes = Object.freeze({
  global: "global",
  workspace: "workspace",
  resource: "resource",
});

export type RoleAssignmentScope = typeof RoleAssignmentScopes[keyof typeof RoleAssignmentScopes];

export const RoleAssignmentStatuses = Object.freeze({
  active: "active",
  revoked: "revoked",
});

export type RoleAssignmentStatus = typeof RoleAssignmentStatuses[keyof typeof RoleAssignmentStatuses];

export type PermissionKey = string;

export const PermissionEffects = Object.freeze({
  allow: "allow",
  deny: "deny",
});

export type PermissionEffect = typeof PermissionEffects[keyof typeof PermissionEffects];

export const PermissionGrantScopes = Object.freeze({
  global: "global",
  workspace: "workspace",
  resource: "resource",
});

export type PermissionGrantScope = typeof PermissionGrantScopes[keyof typeof PermissionGrantScopes];

export interface PermissionGrant {
  readonly id: string;
  readonly permissionKey: PermissionKey;
  readonly effect: PermissionEffect;
  readonly scope: PermissionGrantScope;
  readonly workspaceId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly grantedByUserIdentityId: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
}

export interface RoleAssignment {
  readonly id: string;
  readonly actorUserIdentityId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly scope: RoleAssignmentScope;
  readonly workspaceId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly status: RoleAssignmentStatus;
  readonly assignedByUserIdentityId: string;
  readonly assignedAt: string;
  readonly revokedAt?: string;
}

export const ResourceOwnershipScopes = Object.freeze({
  userPrivate: "user-private",
  workspace: "workspace",
});

export type ResourceOwnershipScope = typeof ResourceOwnershipScopes[keyof typeof ResourceOwnershipScopes];

export const ResourceVisibilities = Object.freeze({
  private: "private",
  workspace: "workspace",
  shared: "shared",
  published: "published",
});

export type ResourceVisibility = typeof ResourceVisibilities[keyof typeof ResourceVisibilities];

export const SharingSubjectKinds = Object.freeze({
  user: "user",
  workspaceRole: "workspace-role",
  workspace: "workspace",
  public: "public",
});

export type SharingSubjectKind = typeof SharingSubjectKinds[keyof typeof SharingSubjectKinds];

export type SharingSubject =
  | Readonly<{
    kind: typeof SharingSubjectKinds.user;
    userIdentityId: string;
  }>
  | Readonly<{
    kind: typeof SharingSubjectKinds.workspaceRole;
    workspaceId: string;
    roleKey: AuthorizationRoleKey;
  }>
  | Readonly<{
    kind: typeof SharingSubjectKinds.workspace;
    workspaceId: string;
  }>
  | Readonly<{
    kind: typeof SharingSubjectKinds.public;
  }>;

export interface SharingGrant {
  readonly id: string;
  readonly subject: SharingSubject;
  readonly permissions: ReadonlyArray<PermissionKey>;
  readonly grantedByUserIdentityId: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly revokedAt?: string;
}

export const SharingPolicyModes = Object.freeze({
  ownerOnly: "owner-only",
  workspaceMembers: "workspace-members",
  explicit: "explicit",
  published: "published",
});

export type SharingPolicyMode = typeof SharingPolicyModes[keyof typeof SharingPolicyModes];

export interface SharingPolicy {
  readonly mode: SharingPolicyMode;
  readonly allowResharing: boolean;
}

export interface ActorContext {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly activeWorkspaceId?: string;
  readonly roleAssignments: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants: ReadonlyArray<PermissionGrant>;
  readonly authenticatedAt?: string;
}

export interface ResourcePolicyContext {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerUserIdentityId: string;
  readonly ownershipScope: ResourceOwnershipScope;
  readonly workspaceId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicy: SharingPolicy;
  readonly sharingGrants: ReadonlyArray<SharingGrant>;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
}

export const PolicyDecisionOutcomes = Object.freeze({
  allow: "allow",
  deny: "deny",
  notApplicable: "not-applicable",
});

export type PolicyDecisionOutcome = typeof PolicyDecisionOutcomes[keyof typeof PolicyDecisionOutcomes];

export interface PolicyDecision {
  readonly outcome: PolicyDecisionOutcome;
  readonly requiredPermissionKey: PermissionKey;
  readonly reasonCode: string;
  readonly reason: string;
  readonly evaluatedAt: string;
  readonly matchedRoleAssignmentIds: ReadonlyArray<string>;
  readonly matchedPermissionGrantIds: ReadonlyArray<string>;
  readonly matchedSharingGrantIds: ReadonlyArray<string>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AuthorizationDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new AuthorizationDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizePermissionKey(value: PermissionKey): PermissionKey {
  const normalized = normalizeRequired(value, "Permission key").toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/.test(normalized)) {
    throw new AuthorizationDomainError(
      `Permission key '${value}' is invalid. Expected namespaced format like 'asset.read' or 'workflow:run'.`,
    );
  }
  return normalized;
}

function normalizeRoleAssignmentScope(value: RoleAssignmentScope): RoleAssignmentScope {
  if (!Object.values(RoleAssignmentScopes).includes(value)) {
    throw new AuthorizationDomainError(`Role assignment scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeRoleAssignmentStatus(value?: RoleAssignmentStatus): RoleAssignmentStatus {
  const normalized = value ?? RoleAssignmentStatuses.active;
  if (!Object.values(RoleAssignmentStatuses).includes(normalized)) {
    throw new AuthorizationDomainError(`Role assignment status '${String(value)}' is invalid.`);
  }
  return normalized;
}

function normalizePermissionEffect(value: PermissionEffect): PermissionEffect {
  if (!Object.values(PermissionEffects).includes(value)) {
    throw new AuthorizationDomainError(`Permission effect '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizePermissionGrantScope(value: PermissionGrantScope): PermissionGrantScope {
  if (!Object.values(PermissionGrantScopes).includes(value)) {
    throw new AuthorizationDomainError(`Permission grant scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeResourceVisibility(value: ResourceVisibility): ResourceVisibility {
  if (!Object.values(ResourceVisibilities).includes(value)) {
    throw new AuthorizationDomainError(`Resource visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeResourceOwnershipScope(value: ResourceOwnershipScope): ResourceOwnershipScope {
  if (!Object.values(ResourceOwnershipScopes).includes(value)) {
    throw new AuthorizationDomainError(`Resource ownership scope '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSharingPolicyMode(value: SharingPolicyMode): SharingPolicyMode {
  if (!Object.values(SharingPolicyModes).includes(value)) {
    throw new AuthorizationDomainError(`Sharing policy mode '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizePolicyDecisionOutcome(value: PolicyDecisionOutcome): PolicyDecisionOutcome {
  if (!Object.values(PolicyDecisionOutcomes).includes(value)) {
    throw new AuthorizationDomainError(`Policy decision outcome '${String(value)}' is invalid.`);
  }
  return value;
}

function isPublicSharingSubject(subject: SharingSubject): boolean {
  return subject.kind === SharingSubjectKinds.public;
}

function normalizeSharingSubject(subject: SharingSubject): SharingSubject {
  switch (subject.kind) {
    case SharingSubjectKinds.user:
      return Object.freeze({
        kind: SharingSubjectKinds.user,
        userIdentityId: normalizeRequired(subject.userIdentityId, "Sharing subject userIdentityId"),
      });
    case SharingSubjectKinds.workspaceRole:
      return Object.freeze({
        kind: SharingSubjectKinds.workspaceRole,
        workspaceId: normalizeRequired(subject.workspaceId, "Sharing subject workspaceId"),
        roleKey: normalizeRequired(subject.roleKey, "Sharing subject roleKey"),
      });
    case SharingSubjectKinds.workspace:
      return Object.freeze({
        kind: SharingSubjectKinds.workspace,
        workspaceId: normalizeRequired(subject.workspaceId, "Sharing subject workspaceId"),
      });
    case SharingSubjectKinds.public:
      return Object.freeze({
        kind: SharingSubjectKinds.public,
      });
    default:
      throw new AuthorizationDomainError(`Sharing subject kind '${String((subject as { kind?: string }).kind)}' is invalid.`);
  }
}

function normalizeSharingGrant(grant: SharingGrant): SharingGrant {
  const grantedAt = normalizeIsoTimestamp(grant.grantedAt, "Sharing grant grantedAt");
  const expiresAt = normalizeOptional(grant.expiresAt);
  const revokedAt = normalizeOptional(grant.revokedAt);
  const normalizedPermissions = [...new Set(
    grant.permissions.map((value) => normalizePermissionKey(value)),
  )];

  if (normalizedPermissions.length === 0) {
    throw new AuthorizationDomainError("Sharing grant permissions must include at least one permission key.");
  }

  if (expiresAt && new Date(expiresAt).getTime() <= new Date(grantedAt).getTime()) {
    throw new AuthorizationDomainError("Sharing grant expiresAt must be later than grantedAt.");
  }

  return Object.freeze({
    id: normalizeRequired(grant.id, "Sharing grant id"),
    subject: normalizeSharingSubject(grant.subject),
    permissions: Object.freeze(normalizedPermissions),
    grantedByUserIdentityId: normalizeRequired(grant.grantedByUserIdentityId, "Sharing grant grantedByUserIdentityId"),
    grantedAt,
    expiresAt,
    revokedAt: revokedAt ? normalizeIsoTimestamp(revokedAt, "Sharing grant revokedAt") : undefined,
  });
}

function normalizeSharingGrants(value: ReadonlyArray<SharingGrant>): ReadonlyArray<SharingGrant> {
  const deduped = new Map<string, SharingGrant>();
  for (const grant of value) {
    const normalized = normalizeSharingGrant(grant);
    if (deduped.has(normalized.id)) {
      throw new AuthorizationDomainError(`Duplicate sharing grant id '${normalized.id}' is not allowed.`);
    }
    deduped.set(normalized.id, normalized);
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeRoleAssignments(value: ReadonlyArray<RoleAssignment>): ReadonlyArray<RoleAssignment> {
  const deduped = new Map<string, RoleAssignment>();
  for (const roleAssignment of value) {
    if (deduped.has(roleAssignment.id)) {
      throw new AuthorizationDomainError(`Duplicate role assignment id '${roleAssignment.id}' is not allowed.`);
    }
    deduped.set(roleAssignment.id, roleAssignment);
  }
  return Object.freeze([...deduped.values()]);
}

function normalizePermissionGrants(value: ReadonlyArray<PermissionGrant>): ReadonlyArray<PermissionGrant> {
  const deduped = new Map<string, PermissionGrant>();
  for (const permissionGrant of value) {
    if (deduped.has(permissionGrant.id)) {
      throw new AuthorizationDomainError(`Duplicate permission grant id '${permissionGrant.id}' is not allowed.`);
    }
    deduped.set(permissionGrant.id, permissionGrant);
  }
  return Object.freeze([...deduped.values()]);
}

function assertRoleAssignmentScopeState(value: RoleAssignment): void {
  if (value.status === RoleAssignmentStatuses.revoked && !value.revokedAt) {
    throw new AuthorizationDomainError("Revoked role assignments must include revokedAt.");
  }
  if (value.status !== RoleAssignmentStatuses.revoked && value.revokedAt) {
    throw new AuthorizationDomainError("Only revoked role assignments may include revokedAt.");
  }

  if (value.scope === RoleAssignmentScopes.global) {
    if (value.workspaceId || value.resourceId || value.resourceType) {
      throw new AuthorizationDomainError("Global role assignments cannot include workspace or resource scope fields.");
    }
    return;
  }

  if (value.scope === RoleAssignmentScopes.workspace) {
    if (!value.workspaceId) {
      throw new AuthorizationDomainError("Workspace role assignments must include workspaceId.");
    }
    if (value.resourceId || value.resourceType) {
      throw new AuthorizationDomainError("Workspace role assignments cannot include resource scope fields.");
    }
    return;
  }

  if (!value.resourceType || !value.resourceId) {
    throw new AuthorizationDomainError("Resource role assignments must include both resourceType and resourceId.");
  }
}

function assertPermissionGrantScopeState(value: PermissionGrant): void {
  if (value.revokedAt && new Date(value.revokedAt).getTime() < new Date(value.grantedAt).getTime()) {
    throw new AuthorizationDomainError("Permission grant revokedAt must be later than or equal to grantedAt.");
  }
  if (value.expiresAt && new Date(value.expiresAt).getTime() <= new Date(value.grantedAt).getTime()) {
    throw new AuthorizationDomainError("Permission grant expiresAt must be later than grantedAt.");
  }

  if (value.scope === PermissionGrantScopes.global) {
    if (value.workspaceId || value.resourceId || value.resourceType) {
      throw new AuthorizationDomainError("Global permission grants cannot include workspace or resource scope fields.");
    }
    return;
  }

  if (value.scope === PermissionGrantScopes.workspace) {
    if (!value.workspaceId) {
      throw new AuthorizationDomainError("Workspace permission grants must include workspaceId.");
    }
    if (value.resourceId || value.resourceType) {
      throw new AuthorizationDomainError("Workspace permission grants cannot include resource scope fields.");
    }
    return;
  }

  if (!value.resourceType || !value.resourceId) {
    throw new AuthorizationDomainError("Resource permission grants must include both resourceType and resourceId.");
  }
}

function assertResourcePolicyContextState(value: ResourcePolicyContext): void {
  if (value.ownershipScope === ResourceOwnershipScopes.userPrivate && value.workspaceId) {
    throw new AuthorizationDomainError("User-private resources cannot include workspaceId.");
  }
  if (value.ownershipScope === ResourceOwnershipScopes.workspace && !value.workspaceId) {
    throw new AuthorizationDomainError("Workspace-scoped resources must include workspaceId.");
  }

  if (value.visibility === ResourceVisibilities.workspace && value.ownershipScope !== ResourceOwnershipScopes.workspace) {
    throw new AuthorizationDomainError("Workspace visibility is only valid for workspace-scoped resources.");
  }

  if (value.visibility === ResourceVisibilities.private && value.sharingGrants.length > 0) {
    throw new AuthorizationDomainError("Private visibility cannot include explicit sharing grants.");
  }

  if (value.visibility === ResourceVisibilities.workspace && value.sharingGrants.length > 0) {
    throw new AuthorizationDomainError("Workspace visibility cannot include explicit sharing grants.");
  }

  if (value.visibility === ResourceVisibilities.shared && value.sharingGrants.length === 0) {
    throw new AuthorizationDomainError("Shared visibility requires at least one sharing grant.");
  }

  if (value.visibility !== ResourceVisibilities.published && value.sharingGrants.some((grant) => isPublicSharingSubject(grant.subject))) {
    throw new AuthorizationDomainError("Public sharing subjects require published visibility.");
  }

  if (value.visibility === ResourceVisibilities.published && !value.isPublishedCapable) {
    throw new AuthorizationDomainError("Published visibility requires isPublishedCapable=true.");
  }

  if (value.visibility === ResourceVisibilities.published && !value.publishedAt) {
    throw new AuthorizationDomainError("Published visibility requires publishedAt.");
  }

  if (value.visibility !== ResourceVisibilities.published && value.publishedAt) {
    throw new AuthorizationDomainError("Only published resources may include publishedAt.");
  }

  switch (value.visibility) {
    case ResourceVisibilities.private:
      if (value.sharingPolicy.mode !== SharingPolicyModes.ownerOnly) {
        throw new AuthorizationDomainError("Private visibility requires sharingPolicy.mode='owner-only'.");
      }
      break;
    case ResourceVisibilities.workspace:
      if (value.sharingPolicy.mode !== SharingPolicyModes.workspaceMembers) {
        throw new AuthorizationDomainError("Workspace visibility requires sharingPolicy.mode='workspace-members'.");
      }
      break;
    case ResourceVisibilities.shared:
      if (value.sharingPolicy.mode !== SharingPolicyModes.explicit) {
        throw new AuthorizationDomainError("Shared visibility requires sharingPolicy.mode='explicit'.");
      }
      break;
    case ResourceVisibilities.published:
      if (value.sharingPolicy.mode !== SharingPolicyModes.published) {
        throw new AuthorizationDomainError("Published visibility requires sharingPolicy.mode='published'.");
      }
      break;
    default:
      break;
  }

  if (!value.workspaceId) {
    for (const grant of value.sharingGrants) {
      if (grant.subject.kind === SharingSubjectKinds.workspace || grant.subject.kind === SharingSubjectKinds.workspaceRole) {
        throw new AuthorizationDomainError("Workspace-oriented sharing subjects require workspace-scoped resources.");
      }
    }
  } else {
    for (const grant of value.sharingGrants) {
      if (
        grant.subject.kind === SharingSubjectKinds.workspace
        && grant.subject.workspaceId !== value.workspaceId
      ) {
        throw new AuthorizationDomainError("Workspace sharing grants must match resource workspaceId.");
      }
      if (
        grant.subject.kind === SharingSubjectKinds.workspaceRole
        && grant.subject.workspaceId !== value.workspaceId
      ) {
        throw new AuthorizationDomainError("Workspace-role sharing grants must match resource workspaceId.");
      }
    }
  }
}

export function createPermissionKey(value: string): PermissionKey {
  return normalizePermissionKey(value);
}

export function createRoleAssignment(input: {
  readonly id: string;
  readonly actorUserIdentityId: string;
  readonly roleKey: AuthorizationRoleKey;
  readonly scope: RoleAssignmentScope;
  readonly workspaceId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly status?: RoleAssignmentStatus;
  readonly assignedByUserIdentityId: string;
  readonly assignedAt?: Date | string;
  readonly revokedAt?: Date | string;
}): RoleAssignment {
  const value: RoleAssignment = Object.freeze({
    id: normalizeRequired(input.id, "Role assignment id"),
    actorUserIdentityId: normalizeRequired(input.actorUserIdentityId, "Role assignment actorUserIdentityId"),
    roleKey: normalizeRequired(input.roleKey, "Role assignment roleKey"),
    scope: normalizeRoleAssignmentScope(input.scope),
    workspaceId: normalizeOptional(input.workspaceId),
    resourceType: normalizeOptional(input.resourceType),
    resourceId: normalizeOptional(input.resourceId),
    status: normalizeRoleAssignmentStatus(input.status),
    assignedByUserIdentityId: normalizeRequired(input.assignedByUserIdentityId, "Role assignment assignedByUserIdentityId"),
    assignedAt: normalizeIsoTimestamp(input.assignedAt ?? new Date(), "Role assignment assignedAt"),
    revokedAt: input.revokedAt ? normalizeIsoTimestamp(input.revokedAt, "Role assignment revokedAt") : undefined,
  });

  assertRoleAssignmentScopeState(value);
  return value;
}

export function createPermissionGrant(input: {
  readonly id: string;
  readonly permissionKey: PermissionKey;
  readonly effect: PermissionEffect;
  readonly scope: PermissionGrantScope;
  readonly workspaceId?: string;
  readonly resourceType?: string;
  readonly resourceId?: string;
  readonly grantedByUserIdentityId: string;
  readonly grantedAt?: Date | string;
  readonly expiresAt?: Date | string;
  readonly revokedAt?: Date | string;
}): PermissionGrant {
  const value: PermissionGrant = Object.freeze({
    id: normalizeRequired(input.id, "Permission grant id"),
    permissionKey: normalizePermissionKey(input.permissionKey),
    effect: normalizePermissionEffect(input.effect),
    scope: normalizePermissionGrantScope(input.scope),
    workspaceId: normalizeOptional(input.workspaceId),
    resourceType: normalizeOptional(input.resourceType),
    resourceId: normalizeOptional(input.resourceId),
    grantedByUserIdentityId: normalizeRequired(input.grantedByUserIdentityId, "Permission grant grantedByUserIdentityId"),
    grantedAt: normalizeIsoTimestamp(input.grantedAt ?? new Date(), "Permission grant grantedAt"),
    expiresAt: input.expiresAt ? normalizeIsoTimestamp(input.expiresAt, "Permission grant expiresAt") : undefined,
    revokedAt: input.revokedAt ? normalizeIsoTimestamp(input.revokedAt, "Permission grant revokedAt") : undefined,
  });

  assertPermissionGrantScopeState(value);
  return value;
}

export function createSharingSubject(input: SharingSubject): SharingSubject {
  return normalizeSharingSubject(input);
}

export function createSharingGrant(input: SharingGrant): SharingGrant {
  return normalizeSharingGrant(input);
}

export function createSharingPolicy(input?: {
  readonly mode?: SharingPolicyMode;
  readonly allowResharing?: boolean;
}): SharingPolicy {
  const mode = normalizeSharingPolicyMode(input?.mode ?? SharingPolicyModes.ownerOnly);
  return Object.freeze({
    mode,
    allowResharing: input?.allowResharing ?? false,
  });
}

export function createActorContext(input: {
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly activeWorkspaceId?: string;
  readonly roleAssignments?: ReadonlyArray<RoleAssignment>;
  readonly permissionGrants?: ReadonlyArray<PermissionGrant>;
  readonly authenticatedAt?: Date | string;
}): ActorContext {
  const actorUserIdentityId = normalizeOptional(input.actorUserIdentityId);
  const actorServiceId = normalizeOptional(input.actorServiceId);
  if (!actorUserIdentityId && !actorServiceId) {
    throw new AuthorizationDomainError("Actor context requires actorUserIdentityId or actorServiceId.");
  }

  return Object.freeze({
    actorUserIdentityId,
    actorServiceId,
    activeWorkspaceId: normalizeOptional(input.activeWorkspaceId),
    roleAssignments: normalizeRoleAssignments(input.roleAssignments ?? []),
    permissionGrants: normalizePermissionGrants(input.permissionGrants ?? []),
    authenticatedAt: input.authenticatedAt
      ? normalizeIsoTimestamp(input.authenticatedAt, "Actor context authenticatedAt")
      : undefined,
  });
}

export function createResourcePolicyContext(input: {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly ownerUserIdentityId: string;
  readonly ownershipScope: ResourceOwnershipScope;
  readonly workspaceId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicy: SharingPolicy;
  readonly sharingGrants?: ReadonlyArray<SharingGrant>;
  readonly isPublishedCapable?: boolean;
  readonly publishedAt?: Date | string;
}): ResourcePolicyContext {
  const value: ResourcePolicyContext = Object.freeze({
    resourceType: normalizeRequired(input.resourceType, "Resource policy context resourceType"),
    resourceId: normalizeRequired(input.resourceId, "Resource policy context resourceId"),
    ownerUserIdentityId: normalizeRequired(input.ownerUserIdentityId, "Resource policy context ownerUserIdentityId"),
    ownershipScope: normalizeResourceOwnershipScope(input.ownershipScope),
    workspaceId: normalizeOptional(input.workspaceId),
    visibility: normalizeResourceVisibility(input.visibility),
    sharingPolicy: createSharingPolicy(input.sharingPolicy),
    sharingGrants: normalizeSharingGrants(input.sharingGrants ?? []),
    isPublishedCapable: input.isPublishedCapable ?? false,
    publishedAt: input.publishedAt ? normalizeIsoTimestamp(input.publishedAt, "Resource policy context publishedAt") : undefined,
  });

  assertResourcePolicyContextState(value);
  return value;
}

export function createPolicyDecision(input: {
  readonly outcome: PolicyDecisionOutcome;
  readonly requiredPermissionKey: PermissionKey;
  readonly reasonCode: string;
  readonly reason: string;
  readonly evaluatedAt?: Date | string;
  readonly matchedRoleAssignmentIds?: ReadonlyArray<string>;
  readonly matchedPermissionGrantIds?: ReadonlyArray<string>;
  readonly matchedSharingGrantIds?: ReadonlyArray<string>;
}): PolicyDecision {
  return Object.freeze({
    outcome: normalizePolicyDecisionOutcome(input.outcome),
    requiredPermissionKey: normalizePermissionKey(input.requiredPermissionKey),
    reasonCode: normalizeRequired(input.reasonCode, "Policy decision reasonCode"),
    reason: normalizeRequired(input.reason, "Policy decision reason"),
    evaluatedAt: normalizeIsoTimestamp(input.evaluatedAt ?? new Date(), "Policy decision evaluatedAt"),
    matchedRoleAssignmentIds: Object.freeze((input.matchedRoleAssignmentIds ?? []).map((value) =>
      normalizeRequired(value, "Policy decision matchedRoleAssignmentId")
    )),
    matchedPermissionGrantIds: Object.freeze((input.matchedPermissionGrantIds ?? []).map((value) =>
      normalizeRequired(value, "Policy decision matchedPermissionGrantId")
    )),
    matchedSharingGrantIds: Object.freeze((input.matchedSharingGrantIds ?? []).map((value) =>
      normalizeRequired(value, "Policy decision matchedSharingGrantId")
    )),
  });
}
