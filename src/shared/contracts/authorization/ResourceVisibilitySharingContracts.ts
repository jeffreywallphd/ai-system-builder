import {
  ResourceVisibilities,
  SharingPolicyModes,
  SharingSubjectKinds,
  type AuthorizationRoleKey,
  type PermissionKey,
  type ResourceVisibility,
  type SharingPolicyMode,
} from "../../../domain/authorization/AuthorizationDomain";
import {
  AuthorizationResourceFamilies,
  type AuthorizationResourceFamily,
} from "../../../domain/authorization/AuthorizationPermissionCatalog";

export class ProtectedResourceAuthorizationContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProtectedResourceAuthorizationContractError";
  }
}

export const ProtectedResourceVisibilities = ResourceVisibilities;
export type ProtectedResourceVisibility = ResourceVisibility;

export const ProtectedResourceSharingPolicyModes = SharingPolicyModes;
export type ProtectedResourceSharingPolicyMode = SharingPolicyMode;

export const ProtectedResourceSharingTargetKinds = SharingSubjectKinds;
export type ProtectedResourceSharingTargetKind =
  typeof ProtectedResourceSharingTargetKinds[keyof typeof ProtectedResourceSharingTargetKinds];

export const ProtectedResourceFamilies = AuthorizationResourceFamilies;
export type ProtectedResourceFamily = AuthorizationResourceFamily;

export interface ProtectedResourceAuthorizationSubject {
  readonly resourceFamily: ProtectedResourceFamily;
  readonly resourceType: string;
  readonly resourceId: string;
}

export type ProtectedResourceSharingTarget =
  | Readonly<{
    kind: typeof ProtectedResourceSharingTargetKinds.user;
    userId: string;
  }>
  | Readonly<{
    kind: typeof ProtectedResourceSharingTargetKinds.workspaceRole;
    workspaceId: string;
    roleKey: AuthorizationRoleKey;
  }>
  | Readonly<{
    kind: typeof ProtectedResourceSharingTargetKinds.workspace;
    workspaceId: string;
  }>
  | Readonly<{
    kind: typeof ProtectedResourceSharingTargetKinds.public;
  }>;

export interface ProtectedResourceSharingGrant {
  readonly id: string;
  readonly target: ProtectedResourceSharingTarget;
  readonly permissionKeys: ReadonlyArray<PermissionKey>;
}

export interface ProtectedResourceSharingPolicy {
  readonly mode: ProtectedResourceSharingPolicyMode;
  readonly allowResharing: boolean;
  readonly grants: ReadonlyArray<ProtectedResourceSharingGrant>;
}

export interface ProtectedResourceAuthorizationContract {
  readonly subject: ProtectedResourceAuthorizationSubject;
  readonly workspaceId?: string;
  readonly ownerUserId: string;
  readonly visibility: ProtectedResourceVisibility;
  readonly sharingPolicy: ProtectedResourceSharingPolicy;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
}

export interface ProtectedResourceAuthorizationDto {
  readonly subject: {
    readonly resourceFamily: ProtectedResourceFamily;
    readonly resourceType: string;
    readonly resourceId: string;
  };
  readonly workspaceId?: string;
  readonly ownerUserId: string;
  readonly visibility: ProtectedResourceVisibility;
  readonly sharingPolicy: {
    readonly mode: ProtectedResourceSharingPolicyMode;
    readonly allowResharing: boolean;
    readonly grants: ReadonlyArray<{
      readonly id: string;
      readonly target: ProtectedResourceSharingTarget;
      readonly permissionKeys: ReadonlyArray<PermissionKey>;
    }>;
  };
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly isPublishedCapable: boolean;
  readonly publishedAt?: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ProtectedResourceAuthorizationContractError(`${field} is required.`);
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
    throw new ProtectedResourceAuthorizationContractError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeVisibility(value: ProtectedResourceVisibility): ProtectedResourceVisibility {
  if (!Object.values(ProtectedResourceVisibilities).includes(value)) {
    throw new ProtectedResourceAuthorizationContractError(`Resource visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSharingPolicyMode(value: ProtectedResourceSharingPolicyMode): ProtectedResourceSharingPolicyMode {
  if (!Object.values(ProtectedResourceSharingPolicyModes).includes(value)) {
    throw new ProtectedResourceAuthorizationContractError(`Sharing policy mode '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizePermissionKey(value: PermissionKey): PermissionKey {
  const normalized = normalizeRequired(value, "Sharing permission key").toLowerCase();
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)+$/.test(normalized)) {
    throw new ProtectedResourceAuthorizationContractError(
      `Sharing permission key '${value}' is invalid. Expected namespaced format like 'asset.read'.`,
    );
  }
  return normalized;
}

function normalizeResourceFamily(value: string): ProtectedResourceFamily {
  if (!Object.values(ProtectedResourceFamilies).includes(value as ProtectedResourceFamily)) {
    throw new ProtectedResourceAuthorizationContractError(`Protected resource family '${value}' is invalid.`);
  }
  return value as ProtectedResourceFamily;
}

function normalizeSubject(input: ProtectedResourceAuthorizationSubject): ProtectedResourceAuthorizationSubject {
  return Object.freeze({
    resourceFamily: normalizeResourceFamily(normalizeRequired(input.resourceFamily, "Resource subject family")),
    resourceType: normalizeRequired(input.resourceType, "Resource subject type"),
    resourceId: normalizeRequired(input.resourceId, "Resource subject id"),
  });
}

function normalizeSharingTarget(input: ProtectedResourceSharingTarget): ProtectedResourceSharingTarget {
  switch (input.kind) {
    case ProtectedResourceSharingTargetKinds.user:
      return Object.freeze({
        kind: ProtectedResourceSharingTargetKinds.user,
        userId: normalizeRequired(input.userId, "Sharing target userId"),
      });
    case ProtectedResourceSharingTargetKinds.workspaceRole:
      return Object.freeze({
        kind: ProtectedResourceSharingTargetKinds.workspaceRole,
        workspaceId: normalizeRequired(input.workspaceId, "Sharing target workspaceId"),
        roleKey: normalizeRequired(input.roleKey, "Sharing target roleKey"),
      });
    case ProtectedResourceSharingTargetKinds.workspace:
      return Object.freeze({
        kind: ProtectedResourceSharingTargetKinds.workspace,
        workspaceId: normalizeRequired(input.workspaceId, "Sharing target workspaceId"),
      });
    case ProtectedResourceSharingTargetKinds.public:
      return Object.freeze({
        kind: ProtectedResourceSharingTargetKinds.public,
      });
    default:
      throw new ProtectedResourceAuthorizationContractError(
        `Sharing target kind '${String((input as { kind?: string }).kind)}' is invalid.`,
      );
  }
}

function normalizeSharingGrants(
  grants: ReadonlyArray<ProtectedResourceSharingGrant>,
): ReadonlyArray<ProtectedResourceSharingGrant> {
  const deduped = new Map<string, ProtectedResourceSharingGrant>();
  for (const grant of grants) {
    const normalizedPermissionKeys = [...new Set(grant.permissionKeys.map((value) => normalizePermissionKey(value)))];
    if (normalizedPermissionKeys.length === 0) {
      throw new ProtectedResourceAuthorizationContractError("Sharing grants must include at least one permission key.");
    }

    const normalizedGrant: ProtectedResourceSharingGrant = Object.freeze({
      id: normalizeRequired(grant.id, "Sharing grant id"),
      target: normalizeSharingTarget(grant.target),
      permissionKeys: Object.freeze(normalizedPermissionKeys),
    });

    if (deduped.has(normalizedGrant.id)) {
      throw new ProtectedResourceAuthorizationContractError(
        `Duplicate sharing grant id '${normalizedGrant.id}' is not allowed.`,
      );
    }
    deduped.set(normalizedGrant.id, normalizedGrant);
  }

  return Object.freeze([...deduped.values()]);
}

function defaultSharingPolicyModeForVisibility(
  visibility: ProtectedResourceVisibility,
): ProtectedResourceSharingPolicyMode {
  switch (visibility) {
    case ProtectedResourceVisibilities.private:
      return ProtectedResourceSharingPolicyModes.ownerOnly;
    case ProtectedResourceVisibilities.workspace:
      return ProtectedResourceSharingPolicyModes.workspaceMembers;
    case ProtectedResourceVisibilities.shared:
      return ProtectedResourceSharingPolicyModes.explicit;
    case ProtectedResourceVisibilities.published:
      return ProtectedResourceSharingPolicyModes.published;
    default:
      return ProtectedResourceSharingPolicyModes.ownerOnly;
  }
}

function assertContractInvariants(value: ProtectedResourceAuthorizationContract): void {
  if (value.visibility === ProtectedResourceVisibilities.workspace && !value.workspaceId) {
    throw new ProtectedResourceAuthorizationContractError(
      "Workspace visibility requires workspaceId.",
    );
  }

  if (value.visibility === ProtectedResourceVisibilities.private) {
    if (value.sharingPolicy.mode !== ProtectedResourceSharingPolicyModes.ownerOnly) {
      throw new ProtectedResourceAuthorizationContractError(
        "Private visibility requires sharingPolicy.mode='owner-only'.",
      );
    }
    if (value.sharingPolicy.grants.length > 0) {
      throw new ProtectedResourceAuthorizationContractError(
        "Private visibility cannot include explicit sharing grants.",
      );
    }
  }

  if (value.visibility === ProtectedResourceVisibilities.workspace) {
    if (value.sharingPolicy.mode !== ProtectedResourceSharingPolicyModes.workspaceMembers) {
      throw new ProtectedResourceAuthorizationContractError(
        "Workspace visibility requires sharingPolicy.mode='workspace-members'.",
      );
    }
    if (value.sharingPolicy.grants.length > 0) {
      throw new ProtectedResourceAuthorizationContractError(
        "Workspace visibility cannot include explicit sharing grants.",
      );
    }
  }

  if (value.visibility === ProtectedResourceVisibilities.shared) {
    if (value.sharingPolicy.mode !== ProtectedResourceSharingPolicyModes.explicit) {
      throw new ProtectedResourceAuthorizationContractError(
        "Shared visibility requires sharingPolicy.mode='explicit'.",
      );
    }
    if (value.sharingPolicy.grants.length === 0) {
      throw new ProtectedResourceAuthorizationContractError(
        "Shared visibility requires at least one explicit sharing grant.",
      );
    }
  }

  if (value.visibility === ProtectedResourceVisibilities.published) {
    if (value.sharingPolicy.mode !== ProtectedResourceSharingPolicyModes.published) {
      throw new ProtectedResourceAuthorizationContractError(
        "Published visibility requires sharingPolicy.mode='published'.",
      );
    }
    if (!value.isPublishedCapable) {
      throw new ProtectedResourceAuthorizationContractError(
        "Published visibility requires isPublishedCapable=true.",
      );
    }
    if (!value.publishedAt) {
      throw new ProtectedResourceAuthorizationContractError(
        "Published visibility requires publishedAt.",
      );
    }
  }

  if (value.visibility !== ProtectedResourceVisibilities.published && value.publishedAt) {
    throw new ProtectedResourceAuthorizationContractError(
      "Only published resources may include publishedAt.",
    );
  }

  for (const grant of value.sharingPolicy.grants) {
    if (grant.target.kind === ProtectedResourceSharingTargetKinds.public) {
      if (value.visibility !== ProtectedResourceVisibilities.published) {
        throw new ProtectedResourceAuthorizationContractError(
          "Public sharing targets require published visibility.",
        );
      }
      continue;
    }

    if (
      grant.target.kind === ProtectedResourceSharingTargetKinds.workspace
      || grant.target.kind === ProtectedResourceSharingTargetKinds.workspaceRole
    ) {
      if (!value.workspaceId) {
        throw new ProtectedResourceAuthorizationContractError(
          "Workspace and workspace-role sharing targets require workspaceId.",
        );
      }

      if (grant.target.workspaceId !== value.workspaceId) {
        throw new ProtectedResourceAuthorizationContractError(
          "Workspace-oriented sharing targets must match the protected resource workspaceId.",
        );
      }
    }
  }
}

export function createUserSharingTarget(userId: string): ProtectedResourceSharingTarget {
  return normalizeSharingTarget({
    kind: ProtectedResourceSharingTargetKinds.user,
    userId,
  });
}

export function createWorkspaceRoleSharingTarget(
  workspaceId: string,
  roleKey: AuthorizationRoleKey,
): ProtectedResourceSharingTarget {
  return normalizeSharingTarget({
    kind: ProtectedResourceSharingTargetKinds.workspaceRole,
    workspaceId,
    roleKey,
  });
}

export function createWorkspaceSharingTarget(workspaceId: string): ProtectedResourceSharingTarget {
  return normalizeSharingTarget({
    kind: ProtectedResourceSharingTargetKinds.workspace,
    workspaceId,
  });
}

export function createPublicSharingTarget(): ProtectedResourceSharingTarget {
  return normalizeSharingTarget({
    kind: ProtectedResourceSharingTargetKinds.public,
  });
}

export function createProtectedResourceSharingPolicy(input: {
  readonly visibility: ProtectedResourceVisibility;
  readonly mode?: ProtectedResourceSharingPolicyMode;
  readonly allowResharing?: boolean;
  readonly grants?: ReadonlyArray<ProtectedResourceSharingGrant>;
}): ProtectedResourceSharingPolicy {
  const mode = normalizeSharingPolicyMode(input.mode ?? defaultSharingPolicyModeForVisibility(input.visibility));
  return Object.freeze({
    mode,
    allowResharing: input.allowResharing ?? false,
    grants: normalizeSharingGrants(input.grants ?? []),
  });
}

export function createProtectedResourceAuthorizationContract(input: {
  readonly subject: ProtectedResourceAuthorizationSubject;
  readonly workspaceId?: string;
  readonly ownerUserId: string;
  readonly visibility?: ProtectedResourceVisibility;
  readonly sharingPolicy?: {
    readonly mode?: ProtectedResourceSharingPolicyMode;
    readonly allowResharing?: boolean;
    readonly grants?: ReadonlyArray<ProtectedResourceSharingGrant>;
  };
  readonly createdBy: string;
  readonly lastModifiedBy?: string;
  readonly isPublishedCapable?: boolean;
  readonly publishedAt?: Date | string;
}): ProtectedResourceAuthorizationContract {
  const visibility = normalizeVisibility(input.visibility ?? ProtectedResourceVisibilities.private);
  const value: ProtectedResourceAuthorizationContract = Object.freeze({
    subject: normalizeSubject(input.subject),
    workspaceId: normalizeOptional(input.workspaceId),
    ownerUserId: normalizeRequired(input.ownerUserId, "Owner user id"),
    visibility,
    sharingPolicy: createProtectedResourceSharingPolicy({
      visibility,
      mode: input.sharingPolicy?.mode,
      allowResharing: input.sharingPolicy?.allowResharing,
      grants: input.sharingPolicy?.grants,
    }),
    createdBy: normalizeRequired(input.createdBy, "Created by"),
    lastModifiedBy: normalizeRequired(input.lastModifiedBy ?? input.createdBy, "Last modified by"),
    isPublishedCapable: input.isPublishedCapable ?? false,
    publishedAt: input.publishedAt ? normalizeIsoTimestamp(input.publishedAt, "Published at") : undefined,
  });

  assertContractInvariants(value);
  return value;
}

export function adaptLegacyProtectedResourceAuthorizationContract(input: {
  readonly subject: ProtectedResourceAuthorizationSubject;
  readonly workspaceId?: string;
  readonly ownerUserId?: string;
  readonly visibility?: ProtectedResourceVisibility;
  readonly sharingPolicy?: {
    readonly mode?: ProtectedResourceSharingPolicyMode;
    readonly allowResharing?: boolean;
    readonly grants?: ReadonlyArray<ProtectedResourceSharingGrant>;
  };
  readonly createdBy?: string;
  readonly lastModifiedBy?: string;
  readonly isPublishedCapable?: boolean;
  readonly publishedAt?: Date | string;
}): ProtectedResourceAuthorizationContract {
  const ownerUserId = normalizeOptional(input.ownerUserId);
  const createdBy = normalizeOptional(input.createdBy);
  const lastModifiedBy = normalizeOptional(input.lastModifiedBy);

  if (!ownerUserId && !createdBy) {
    throw new ProtectedResourceAuthorizationContractError(
      "Legacy adaptation requires ownerUserId or createdBy.",
    );
  }

  const canonicalCreatedBy = createdBy ?? (ownerUserId as string);
  const canonicalOwnerUserId = ownerUserId ?? canonicalCreatedBy;

  return createProtectedResourceAuthorizationContract({
    subject: input.subject,
    workspaceId: input.workspaceId,
    ownerUserId: canonicalOwnerUserId,
    visibility: input.visibility,
    sharingPolicy: input.sharingPolicy,
    createdBy: canonicalCreatedBy,
    lastModifiedBy: lastModifiedBy ?? canonicalCreatedBy,
    isPublishedCapable: input.isPublishedCapable,
    publishedAt: input.publishedAt,
  });
}

export function toProtectedResourceAuthorizationDto(
  value: ProtectedResourceAuthorizationContract,
): ProtectedResourceAuthorizationDto {
  return {
    subject: {
      resourceFamily: value.subject.resourceFamily,
      resourceType: value.subject.resourceType,
      resourceId: value.subject.resourceId,
    },
    workspaceId: value.workspaceId,
    ownerUserId: value.ownerUserId,
    visibility: value.visibility,
    sharingPolicy: {
      mode: value.sharingPolicy.mode,
      allowResharing: value.sharingPolicy.allowResharing,
      grants: value.sharingPolicy.grants.map((grant) => ({
        id: grant.id,
        target: grant.target,
        permissionKeys: [...grant.permissionKeys],
      })),
    },
    createdBy: value.createdBy,
    lastModifiedBy: value.lastModifiedBy,
    isPublishedCapable: value.isPublishedCapable,
    publishedAt: value.publishedAt,
  };
}

export function rehydrateProtectedResourceAuthorizationFromDto(
  value: ProtectedResourceAuthorizationDto,
): ProtectedResourceAuthorizationContract {
  return createProtectedResourceAuthorizationContract({
    subject: {
      resourceFamily: value.subject.resourceFamily,
      resourceType: value.subject.resourceType,
      resourceId: value.subject.resourceId,
    },
    workspaceId: value.workspaceId,
    ownerUserId: value.ownerUserId,
    visibility: value.visibility,
    sharingPolicy: {
      mode: value.sharingPolicy.mode,
      allowResharing: value.sharingPolicy.allowResharing,
      grants: value.sharingPolicy.grants,
    },
    createdBy: value.createdBy,
    lastModifiedBy: value.lastModifiedBy,
    isPublishedCapable: value.isPublishedCapable,
    publishedAt: value.publishedAt,
  });
}
