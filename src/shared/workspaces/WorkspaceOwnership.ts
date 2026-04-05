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

export interface WorkspaceOwnershipMetadata {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly visibility: WorkspaceVisibility;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly lastModifiedAt: string;
}

export interface WorkspaceScopedOwnership {
  readonly ownership: WorkspaceOwnershipMetadata;
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

export function createWorkspaceOwnershipMetadata(input: {
  readonly workspaceId: string;
  readonly ownerUserId: string;
  readonly visibility?: WorkspaceVisibility;
  readonly createdBy: string;
  readonly now?: Date;
}): WorkspaceOwnershipMetadata {
  const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Ownership createdAt");
  const ownerUserId = normalizeRequired(input.ownerUserId, "Ownership ownerUserId");
  const createdBy = normalizeRequired(input.createdBy, "Ownership createdBy");

  if (createdBy !== ownerUserId) {
    throw new WorkspaceOwnershipError("Workspace ownership createdBy must match ownerUserId.");
  }

  return Object.freeze({
    workspaceId: normalizeRequired(input.workspaceId, "Ownership workspaceId"),
    ownerUserId,
    visibility: normalizeVisibility(input.visibility ?? WorkspaceVisibilities.private),
    createdBy,
    lastModifiedBy: createdBy,
    createdAt: nowIso,
    lastModifiedAt: nowIso,
  });
}

export function withWorkspaceOwnershipVisibility(
  ownership: WorkspaceOwnershipMetadata,
  visibility: WorkspaceVisibility,
  actorUserId: string,
  now: Date = new Date(),
): WorkspaceOwnershipMetadata {
  return Object.freeze({
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
  return Object.freeze({
    ...ownership,
    ownerUserId: normalizeRequired(ownerUserId, "Ownership ownerUserId"),
    lastModifiedBy: normalizeRequired(actorUserId, "Ownership lastModifiedBy"),
    lastModifiedAt: normalizeIsoTimestamp(now, "Ownership lastModifiedAt"),
  });
}
