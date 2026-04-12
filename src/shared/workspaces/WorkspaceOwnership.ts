export class WorkspaceOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceOwnershipError";
  }
}

export const WorkspaceVisibilities = Object.freeze({
  private: "private",
  team: "team",
  public: "public",
});

export type WorkspaceVisibility = typeof WorkspaceVisibilities[keyof typeof WorkspaceVisibilities];

export interface WorkspaceSharingPolicyReference {
  readonly policyId: string;
  readonly policyVersion?: string;
}

export interface WorkspaceOwnershipMetadata {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly visibility: WorkspaceVisibility;
  readonly sharingPolicy?: WorkspaceSharingPolicyReference;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly lastModifiedAt: string;
}

export interface WorkspaceScopedOwnership {
  readonly ownership: WorkspaceOwnershipMetadata;
}

export interface WorkspaceScopedResource {
  readonly workspaceId: string;
}

export type WorkspaceOwnedResource<TResource extends WorkspaceScopedResource> = Readonly<TResource & WorkspaceScopedOwnership>;

interface WorkspaceOwnershipMetadataInput {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly visibility?: WorkspaceVisibility;
  readonly sharingPolicy?: WorkspaceSharingPolicyReference;
  readonly createdBy: string;
  readonly lastModifiedBy?: string;
  readonly createdAt: Date | string;
  readonly lastModifiedAt?: Date | string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new WorkspaceOwnershipError(`${field} is required.`);
  }
  return normalized;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new WorkspaceOwnershipError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeVisibility(value: WorkspaceVisibility): WorkspaceVisibility {
  if (!Object.values(WorkspaceVisibilities).includes(value)) {
    throw new WorkspaceOwnershipError(`Workspace visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSharingPolicyReference(
  value: WorkspaceSharingPolicyReference | undefined,
  field: string,
): WorkspaceSharingPolicyReference | undefined {
  if (!value) {
    return undefined;
  }

  const policyId = normalizeRequired(value.policyId, `${field} policyId`);
  const policyVersion = value.policyVersion?.trim();

  return Object.freeze({
    policyId,
    policyVersion: policyVersion && policyVersion.length > 0 ? policyVersion : undefined,
  });
}

function createNormalizedOwnershipMetadata(
  input: WorkspaceOwnershipMetadataInput,
): WorkspaceOwnershipMetadata {
  const createdAt = normalizeIsoTimestamp(input.createdAt, "Ownership createdAt");
  const workspaceId = normalizeRequired(input.workspaceId, "Ownership workspaceId");
  const ownerUserId = normalizeRequired(input.ownerUserId, "Ownership ownerUserId");
  const createdBy = normalizeRequired(input.createdBy, "Ownership createdBy");
  const lastModifiedBy = normalizeRequired(input.lastModifiedBy ?? createdBy, "Ownership lastModifiedBy");
  const lastModifiedAt = normalizeIsoTimestamp(input.lastModifiedAt ?? createdAt, "Ownership lastModifiedAt");

  return Object.freeze({
    workspaceId,
    ownerUserId,
    visibility: normalizeVisibility(input.visibility ?? WorkspaceVisibilities.private),
    sharingPolicy: normalizeSharingPolicyReference(input.sharingPolicy, "Ownership sharingPolicy"),
    createdBy,
    lastModifiedBy,
    createdAt,
    lastModifiedAt,
  });
}

export function createWorkspaceOwnershipMetadata(input: {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly visibility?: WorkspaceVisibility;
  readonly sharingPolicy?: WorkspaceSharingPolicyReference;
  readonly createdBy: string;
  readonly now?: Date;
}): WorkspaceOwnershipMetadata {
  const ownership = createNormalizedOwnershipMetadata({
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    visibility: input.visibility,
    sharingPolicy: input.sharingPolicy,
    createdBy: input.createdBy,
    createdAt: input.now ?? new Date(),
  });

  if (ownership.createdBy !== ownership.ownerUserId) {
    throw new WorkspaceOwnershipError("Workspace ownership createdBy must match ownerUserId.");
  }

  return ownership;
}

export function rehydrateWorkspaceOwnershipMetadata(input: {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly visibility: WorkspaceVisibility;
  readonly sharingPolicy?: WorkspaceSharingPolicyReference;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: Date | string;
  readonly lastModifiedAt: Date | string;
}): WorkspaceOwnershipMetadata {
  return createNormalizedOwnershipMetadata({
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    visibility: input.visibility,
    sharingPolicy: input.sharingPolicy,
    createdBy: input.createdBy,
    lastModifiedBy: input.lastModifiedBy,
    createdAt: input.createdAt,
    lastModifiedAt: input.lastModifiedAt,
  });
}

export function touchWorkspaceOwnershipMetadata(
  ownership: WorkspaceOwnershipMetadata,
  actorUserId: string,
  now: Date = new Date(),
): WorkspaceOwnershipMetadata {
  return rehydrateWorkspaceOwnershipMetadata({
    ...ownership,
    lastModifiedBy: normalizeRequired(actorUserId, "Ownership lastModifiedBy"),
    lastModifiedAt: normalizeIsoTimestamp(now, "Ownership lastModifiedAt"),
  });
}

export function withWorkspaceOwnershipVisibility(
  ownership: WorkspaceOwnershipMetadata,
  visibility: WorkspaceVisibility,
  actorUserId: string,
  now: Date = new Date(),
): WorkspaceOwnershipMetadata {
  return rehydrateWorkspaceOwnershipMetadata({
    ...ownership,
    visibility: normalizeVisibility(visibility),
    lastModifiedBy: normalizeRequired(actorUserId, "Ownership lastModifiedBy"),
    lastModifiedAt: normalizeIsoTimestamp(now, "Ownership lastModifiedAt"),
  });
}

export function withWorkspaceOwner(
  ownership: WorkspaceOwnershipMetadata,
  ownerUserId: string,
  actorUserId: string,
  now: Date = new Date(),
): WorkspaceOwnershipMetadata {
  return rehydrateWorkspaceOwnershipMetadata({
    ...ownership,
    ownerUserId: normalizeRequired(ownerUserId, "Ownership ownerUserId"),
    lastModifiedBy: normalizeRequired(actorUserId, "Ownership lastModifiedBy"),
    lastModifiedAt: normalizeIsoTimestamp(now, "Ownership lastModifiedAt"),
  });
}

export function withWorkspaceOwnershipSharingPolicy(
  ownership: WorkspaceOwnershipMetadata,
  sharingPolicy: WorkspaceSharingPolicyReference | undefined,
  actorUserId: string,
  now: Date = new Date(),
): WorkspaceOwnershipMetadata {
  return rehydrateWorkspaceOwnershipMetadata({
    ...ownership,
    sharingPolicy: normalizeSharingPolicyReference(sharingPolicy, "Ownership sharingPolicy"),
    lastModifiedBy: normalizeRequired(actorUserId, "Ownership lastModifiedBy"),
    lastModifiedAt: normalizeIsoTimestamp(now, "Ownership lastModifiedAt"),
  });
}

export function withWorkspaceScopedOwnership<TResource extends WorkspaceScopedResource>(
  resource: TResource,
  ownership: WorkspaceOwnershipMetadata,
): WorkspaceOwnedResource<TResource> {
  const resourceWorkspaceId = normalizeRequired(resource.workspaceId, "Resource workspaceId");
  if (resourceWorkspaceId !== ownership.workspaceId) {
    throw new WorkspaceOwnershipError(
      `Resource workspaceId '${resourceWorkspaceId}' must match ownership workspaceId '${ownership.workspaceId}'.`,
    );
  }

  return Object.freeze({
    ...resource,
    ownership: rehydrateWorkspaceOwnershipMetadata(ownership),
  });
}
