export class AssetDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetDomainError";
  }
}

export class AssetLifecycleTransitionError extends AssetDomainError {
  constructor(fromState: AssetLifecycleState, toState: AssetLifecycleState) {
    super(`Asset lifecycle cannot transition from '${fromState}' to '${toState}'.`);
    this.name = "AssetLifecycleTransitionError";
  }
}

export const AssetKinds = Object.freeze({
  uploadedFile: "uploaded-file",
  generatedOutput: "generated-output",
  preview: "preview",
  derived: "derived",
});

export type AssetKind = typeof AssetKinds[keyof typeof AssetKinds];

export const AssetVisibilities = Object.freeze({
  private: "private",
  workspace: "workspace",
  shared: "shared",
  published: "published",
});

export type AssetVisibility = typeof AssetVisibilities[keyof typeof AssetVisibilities];

export const AssetLifecycleStates = Object.freeze({
  active: "active",
  archived: "archived",
  deleted: "deleted",
});

export type AssetLifecycleState = typeof AssetLifecycleStates[keyof typeof AssetLifecycleStates];

export const AssetChecksumAlgorithms = Object.freeze({
  sha256: "sha256",
  sha512: "sha512",
  md5: "md5",
});

export type AssetChecksumAlgorithm =
  typeof AssetChecksumAlgorithms[keyof typeof AssetChecksumAlgorithms];

export const AssetStorageAreas = Object.freeze({
  input: "input",
  output: "output",
  preview: "preview",
  reference: "reference",
  temporary: "temporary",
});

export type AssetStorageArea = typeof AssetStorageAreas[keyof typeof AssetStorageAreas];

export interface AssetSharingPolicyReference {
  readonly policyId: string;
  readonly policyVersion?: string;
}

export interface StorageInstanceRef {
  readonly storageInstanceId: string;
  readonly uri: string;
}

export interface AssetLocationRef {
  readonly storageInstance: StorageInstanceRef;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
}

export interface ContentChecksum {
  readonly algorithm: AssetChecksumAlgorithm;
  readonly digest: string;
}

export interface ContentDescriptor {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: ContentChecksum;
  readonly originalFileName?: string;
}

export interface AssetOwnershipMetadata {
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastModifiedBy: string;
  readonly lastModifiedAt: string;
}

export type AssetId = string;

export interface AssetVersion {
  readonly versionId: string;
  readonly revision: number;
  readonly location: AssetLocationRef;
  readonly content: ContentDescriptor;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface AssetLifecycleMetadata {
  readonly state: AssetLifecycleState;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface Asset {
  readonly id: AssetId;
  readonly kind: AssetKind;
  readonly ownership: AssetOwnershipMetadata;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly storageBinding: StorageInstanceRef;
  readonly versions: ReadonlyArray<AssetVersion>;
  readonly currentVersionId: string;
  readonly lifecycle: AssetLifecycleMetadata;
}

export const AssetLifecycleTransitions: Readonly<Record<AssetLifecycleState, ReadonlyArray<AssetLifecycleState>>> =
  Object.freeze({
    [AssetLifecycleStates.active]: Object.freeze([
      AssetLifecycleStates.archived,
      AssetLifecycleStates.deleted,
    ]),
    [AssetLifecycleStates.archived]: Object.freeze([
      AssetLifecycleStates.active,
      AssetLifecycleStates.deleted,
    ]),
    [AssetLifecycleStates.deleted]: Object.freeze([]),
  });

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new AssetDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new AssetDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeAssetId(value: string): AssetId {
  const normalized = normalizeRequired(value, "Asset id");
  if (!/^[a-z0-9][a-z0-9-]{2,126}$/.test(normalized)) {
    throw new AssetDomainError(
      "Asset id must be lowercase alphanumeric with optional '-' and 3-127 characters.",
    );
  }
  return normalized;
}

function normalizeAssetKind(value: AssetKind): AssetKind {
  if (!Object.values(AssetKinds).includes(value)) {
    throw new AssetDomainError(`Asset kind '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeVisibility(value: AssetVisibility): AssetVisibility {
  if (!Object.values(AssetVisibilities).includes(value)) {
    throw new AssetDomainError(`Asset visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeLifecycleState(value?: AssetLifecycleState): AssetLifecycleState {
  const resolved = value ?? AssetLifecycleStates.active;
  if (!Object.values(AssetLifecycleStates).includes(resolved)) {
    throw new AssetDomainError(`Asset lifecycle state '${String(value)}' is invalid.`);
  }
  return resolved;
}

function normalizeChecksumAlgorithm(value: AssetChecksumAlgorithm): AssetChecksumAlgorithm {
  if (!Object.values(AssetChecksumAlgorithms).includes(value)) {
    throw new AssetDomainError(`Asset checksum algorithm '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeStorageArea(value: AssetStorageArea): AssetStorageArea {
  if (!Object.values(AssetStorageAreas).includes(value)) {
    throw new AssetDomainError(`Asset storage area '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeStorageInstanceId(value: string): string {
  const normalized = normalizeRequired(value, "Storage instance id");
  if (!/^[a-z0-9][a-z0-9-]{2,126}$/.test(normalized)) {
    throw new AssetDomainError(
      "Storage instance id must be lowercase alphanumeric with optional '-' and 3-127 characters.",
    );
  }
  return normalized;
}

function normalizeStorageUri(uri: string): StorageInstanceRef {
  const normalized = normalizeRequired(uri, "Storage instance uri");
  const match = /^storage-instance:\/\/([a-z0-9][a-z0-9-]{2,126})$/.exec(normalized);
  if (!match) {
    throw new AssetDomainError(
      "Storage instance uri must use 'storage-instance://<id>' format.",
    );
  }

  return Object.freeze({
    storageInstanceId: match[1],
    uri: normalized,
  });
}

function normalizeStorageInstanceRef(
  input: string | { readonly storageInstanceId: string; readonly uri?: string },
): StorageInstanceRef {
  if (typeof input === "string") {
    return normalizeStorageUri(input);
  }

  const storageInstanceId = normalizeStorageInstanceId(input.storageInstanceId);
  const uri = normalizeOptional(input.uri) ?? `storage-instance://${storageInstanceId}`;
  const fromUri = normalizeStorageUri(uri);
  if (fromUri.storageInstanceId !== storageInstanceId) {
    throw new AssetDomainError(
      "Storage instance reference uri must match storageInstanceId.",
    );
  }

  return fromUri;
}

function normalizeObjectKey(value: string): string {
  const normalized = normalizeRequired(value, "Asset location objectKey");

  if (normalized.startsWith("/")) {
    throw new AssetDomainError("Asset location objectKey cannot be an absolute path.");
  }

  if (normalized.includes("\\")) {
    throw new AssetDomainError("Asset location objectKey cannot include Windows path separators.");
  }

  if (/^[a-zA-Z]:\//.test(normalized)) {
    throw new AssetDomainError("Asset location objectKey cannot include drive-letter path prefixes.");
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new AssetDomainError("Asset location objectKey contains invalid path traversal segments.");
  }

  return normalized;
}

function normalizeMimeType(value: string): string {
  const normalized = normalizeRequired(value, "Asset content mimeType").toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(normalized)) {
    throw new AssetDomainError(`Asset content mimeType '${value}' is invalid.`);
  }
  return normalized;
}

function normalizeChecksumDigest(value: string): string {
  const normalized = normalizeRequired(value, "Asset content checksum digest").toLowerCase();
  if (!/^[a-f0-9]{32,128}$/.test(normalized)) {
    throw new AssetDomainError(
      "Asset content checksum digest must be a lowercase hex string (32-128 chars).",
    );
  }
  return normalized;
}

function normalizeVersionId(value: string): string {
  const normalized = normalizeRequired(value, "Asset version id");
  if (!/^[a-zA-Z0-9._:-]{3,128}$/.test(normalized)) {
    throw new AssetDomainError(
      "Asset version id must be 3-128 characters and use letters, numbers, '.', '_', ':', or '-'.",
    );
  }
  return normalized;
}

function normalizeRevision(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new AssetDomainError("Asset version revision must be an integer >= 1.");
  }
  return value;
}

function normalizeOwnershipMetadata(input: AssetOwnershipMetadata): AssetOwnershipMetadata {
  const createdAt = normalizeTimestamp(input.createdAt, "Asset ownership createdAt");
  const lastModifiedAt = normalizeTimestamp(input.lastModifiedAt, "Asset ownership lastModifiedAt");

  if (new Date(lastModifiedAt).getTime() < new Date(createdAt).getTime()) {
    throw new AssetDomainError("Asset ownership lastModifiedAt cannot be earlier than createdAt.");
  }

  return Object.freeze({
    workspaceId: normalizeRequired(input.workspaceId, "Asset ownership workspaceId"),
    ownerUserId: normalizeOptional(input.ownerUserId),
    createdBy: normalizeRequired(input.createdBy, "Asset ownership createdBy"),
    createdAt,
    lastModifiedBy: normalizeRequired(input.lastModifiedBy, "Asset ownership lastModifiedBy"),
    lastModifiedAt,
  });
}

function normalizeSharingPolicyRef(
  input: AssetSharingPolicyReference | undefined,
): AssetSharingPolicyReference | undefined {
  if (!input) {
    return undefined;
  }

  return Object.freeze({
    policyId: normalizeRequired(input.policyId, "Asset sharingPolicyRef policyId"),
    policyVersion: normalizeOptional(input.policyVersion),
  });
}

function normalizeLocationRef(input: AssetLocationRef): AssetLocationRef {
  return Object.freeze({
    storageInstance: normalizeStorageInstanceRef(input.storageInstance),
    objectKey: normalizeObjectKey(input.objectKey),
    objectVersionId: normalizeOptional(input.objectVersionId),
    area: normalizeStorageArea(input.area),
  });
}

function normalizeContentDescriptor(input: ContentDescriptor): ContentDescriptor {
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 0) {
    throw new AssetDomainError("Asset content sizeBytes must be an integer >= 0.");
  }

  return Object.freeze({
    mimeType: normalizeMimeType(input.mimeType),
    sizeBytes: input.sizeBytes,
    checksum: Object.freeze({
      algorithm: normalizeChecksumAlgorithm(input.checksum.algorithm),
      digest: normalizeChecksumDigest(input.checksum.digest),
    }),
    originalFileName: normalizeOptional(input.originalFileName),
  });
}

function normalizeAssetVersion(input: AssetVersion): AssetVersion {
  return Object.freeze({
    versionId: normalizeVersionId(input.versionId),
    revision: normalizeRevision(input.revision),
    location: normalizeLocationRef(input.location),
    content: normalizeContentDescriptor(input.content),
    createdBy: normalizeRequired(input.createdBy, "Asset version createdBy"),
    createdAt: normalizeTimestamp(input.createdAt, "Asset version createdAt"),
  });
}

function normalizeLifecycle(input: AssetLifecycleMetadata | undefined): AssetLifecycleMetadata {
  const state = normalizeLifecycleState(input?.state);
  const archivedAt = input?.archivedAt
    ? normalizeTimestamp(input.archivedAt, "Asset lifecycle archivedAt")
    : undefined;
  const deletedAt = input?.deletedAt
    ? normalizeTimestamp(input.deletedAt, "Asset lifecycle deletedAt")
    : undefined;
  const archivedBy = normalizeOptional(input?.archivedBy);
  const deletedBy = normalizeOptional(input?.deletedBy);

  const value: AssetLifecycleMetadata = Object.freeze({
    state,
    archivedAt,
    archivedBy,
    deletedAt,
    deletedBy,
  });

  assertLifecycleState(value);
  return value;
}

function assertVisibilityOwnershipInvariants(input: {
  readonly ownership: AssetOwnershipMetadata;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
}): void {
  if (!input.ownership.ownerUserId && input.visibility === AssetVisibilities.private) {
    throw new AssetDomainError(
      "Private visibility requires ownerUserId; workspace-owned assets cannot be private.",
    );
  }

  if (input.visibility === AssetVisibilities.private || input.visibility === AssetVisibilities.workspace) {
    if (input.sharingPolicyRef) {
      throw new AssetDomainError(
        `Asset visibility '${input.visibility}' cannot include sharingPolicyRef.`,
      );
    }
  }

  if (
    (input.visibility === AssetVisibilities.shared || input.visibility === AssetVisibilities.published)
    && !input.sharingPolicyRef
  ) {
    throw new AssetDomainError(
      `Asset visibility '${input.visibility}' requires sharingPolicyRef.`,
    );
  }
}

function assertLifecycleState(value: AssetLifecycleMetadata): void {
  if (value.state === AssetLifecycleStates.active) {
    if (value.archivedAt || value.archivedBy || value.deletedAt || value.deletedBy) {
      throw new AssetDomainError("Active assets cannot include archive/delete lifecycle timestamps.");
    }
    return;
  }

  if (value.state === AssetLifecycleStates.archived) {
    if (!value.archivedAt || !value.archivedBy) {
      throw new AssetDomainError("Archived assets must include archivedAt and archivedBy.");
    }
    if (value.deletedAt || value.deletedBy) {
      throw new AssetDomainError("Archived assets cannot include deletedAt or deletedBy.");
    }
    return;
  }

  if (!value.archivedAt || !value.archivedBy) {
    throw new AssetDomainError("Deleted assets must include archivedAt and archivedBy.");
  }
  if (!value.deletedAt || !value.deletedBy) {
    throw new AssetDomainError("Deleted assets must include deletedAt and deletedBy.");
  }
  if (new Date(value.deletedAt).getTime() < new Date(value.archivedAt).getTime()) {
    throw new AssetDomainError("Asset deletedAt cannot be earlier than archivedAt.");
  }
}

function assertVersionSetInvariants(
  versions: ReadonlyArray<AssetVersion>,
  storageBinding: StorageInstanceRef,
  currentVersionId: string,
): void {
  if (versions.length < 1) {
    throw new AssetDomainError("Asset must include at least one version.");
  }

  const ids = new Set<string>();
  const revisions = new Set<number>();
  for (const version of versions) {
    if (ids.has(version.versionId)) {
      throw new AssetDomainError(`Duplicate asset version id '${version.versionId}' is not allowed.`);
    }
    ids.add(version.versionId);

    if (revisions.has(version.revision)) {
      throw new AssetDomainError(`Duplicate asset version revision '${version.revision}' is not allowed.`);
    }
    revisions.add(version.revision);

    if (version.location.storageInstance.storageInstanceId !== storageBinding.storageInstanceId) {
      throw new AssetDomainError(
        "Asset version storage instance must match asset storageBinding.",
      );
    }
  }

  const ordered = [...versions].sort((left, right) => left.revision - right.revision);
  for (let index = 0; index < ordered.length; index += 1) {
    const expectedRevision = index + 1;
    if (ordered[index].revision !== expectedRevision) {
      throw new AssetDomainError(
        "Asset versions must use contiguous revisions starting at 1.",
      );
    }
  }

  const latest = ordered[ordered.length - 1];
  if (latest.versionId !== currentVersionId) {
    throw new AssetDomainError("Asset currentVersionId must reference the latest revision.");
  }
}

function assertAssetState(asset: Asset): void {
  assertVisibilityOwnershipInvariants(asset);
  assertLifecycleState(asset.lifecycle);
  assertVersionSetInvariants(asset.versions, asset.storageBinding, asset.currentVersionId);
}

function touchOwnership(
  ownership: AssetOwnershipMetadata,
  actorUserId: string,
  occurredAt: Date | string,
): AssetOwnershipMetadata {
  return normalizeOwnershipMetadata({
    ...ownership,
    lastModifiedBy: normalizeRequired(actorUserId, "Asset ownership lastModifiedBy"),
    lastModifiedAt: normalizeTimestamp(occurredAt, "Asset ownership lastModifiedAt"),
  });
}

function isAssetTransitionAllowed(from: AssetLifecycleState, to: AssetLifecycleState): boolean {
  if (from === to) {
    return true;
  }
  return AssetLifecycleTransitions[from].includes(to);
}

export function createAssetId(value: string): AssetId {
  return normalizeAssetId(value);
}

export function createStorageInstanceRef(
  input: string | { readonly storageInstanceId: string; readonly uri?: string },
): StorageInstanceRef {
  return normalizeStorageInstanceRef(input);
}

export function createAssetLocationRef(input: {
  readonly storageInstance: string | { readonly storageInstanceId: string; readonly uri?: string };
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
}): AssetLocationRef {
  return normalizeLocationRef({
    storageInstance: createStorageInstanceRef(input.storageInstance),
    objectKey: input.objectKey,
    objectVersionId: input.objectVersionId,
    area: input.area,
  });
}

export function createContentDescriptor(input: {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: {
    readonly algorithm: AssetChecksumAlgorithm;
    readonly digest: string;
  };
  readonly originalFileName?: string;
}): ContentDescriptor {
  return normalizeContentDescriptor({
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    checksum: {
      algorithm: input.checksum.algorithm,
      digest: input.checksum.digest,
    },
    originalFileName: input.originalFileName,
  });
}

export function createAssetOwnershipMetadata(input: {
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly createdBy: string;
  readonly createdAt?: Date | string;
  readonly lastModifiedBy?: string;
  readonly lastModifiedAt?: Date | string;
}): AssetOwnershipMetadata {
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date(), "Asset ownership createdAt");

  return normalizeOwnershipMetadata({
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    createdBy: input.createdBy,
    createdAt,
    lastModifiedBy: input.lastModifiedBy ?? input.createdBy,
    lastModifiedAt: input.lastModifiedAt ?? createdAt,
  });
}

export function createAssetVersion(input: {
  readonly versionId: string;
  readonly revision: number;
  readonly location: AssetLocationRef;
  readonly content: ContentDescriptor;
  readonly createdBy: string;
  readonly createdAt?: Date | string;
}): AssetVersion {
  return normalizeAssetVersion({
    versionId: input.versionId,
    revision: input.revision,
    location: input.location,
    content: input.content,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? new Date(),
  });
}

export function rehydrateAsset(input: {
  readonly id: string;
  readonly kind: AssetKind;
  readonly ownership: AssetOwnershipMetadata;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly storageBinding: StorageInstanceRef;
  readonly versions: ReadonlyArray<AssetVersion>;
  readonly currentVersionId: string;
  readonly lifecycle?: AssetLifecycleMetadata;
}): Asset {
  const asset: Asset = Object.freeze({
    id: normalizeAssetId(input.id),
    kind: normalizeAssetKind(input.kind),
    ownership: normalizeOwnershipMetadata(input.ownership),
    visibility: normalizeVisibility(input.visibility),
    sharingPolicyRef: normalizeSharingPolicyRef(input.sharingPolicyRef),
    storageBinding: normalizeStorageInstanceRef(input.storageBinding),
    versions: Object.freeze(input.versions.map((version) => normalizeAssetVersion(version))),
    currentVersionId: normalizeVersionId(input.currentVersionId),
    lifecycle: normalizeLifecycle(input.lifecycle),
  });

  assertAssetState(asset);
  return asset;
}

export function createAsset(input: {
  readonly id: string;
  readonly kind: AssetKind;
  readonly ownership: AssetOwnershipMetadata;
  readonly visibility?: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReference;
  readonly storageBinding: StorageInstanceRef;
  readonly initialVersion: AssetVersion;
}): Asset {
  return rehydrateAsset({
    id: input.id,
    kind: input.kind,
    ownership: input.ownership,
    visibility: input.visibility ?? AssetVisibilities.private,
    sharingPolicyRef: input.sharingPolicyRef,
    storageBinding: input.storageBinding,
    versions: [input.initialVersion],
    currentVersionId: input.initialVersion.versionId,
    lifecycle: {
      state: AssetLifecycleStates.active,
    },
  });
}

export function addAssetVersion(
  asset: Asset,
  input: {
    readonly versionId: string;
    readonly location: AssetLocationRef;
    readonly content: ContentDescriptor;
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
  },
): Asset {
  if (asset.lifecycle.state !== AssetLifecycleStates.active) {
    throw new AssetDomainError("Asset versions can only be added while asset is active.");
  }

  const nextRevision = asset.versions.length + 1;
  const createdAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Asset version createdAt");
  const nextVersion = createAssetVersion({
    versionId: input.versionId,
    revision: nextRevision,
    location: input.location,
    content: input.content,
    createdBy: input.actorUserId,
    createdAt,
  });

  const updated = rehydrateAsset({
    ...asset,
    ownership: touchOwnership(asset.ownership, input.actorUserId, createdAt),
    versions: [...asset.versions, nextVersion],
    currentVersionId: nextVersion.versionId,
  });

  return updated;
}

export function updateAssetVisibility(
  asset: Asset,
  input: {
    readonly visibility: AssetVisibility;
    readonly sharingPolicyRef?: AssetSharingPolicyReference;
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
  },
): Asset {
  if (asset.lifecycle.state === AssetLifecycleStates.deleted) {
    throw new AssetDomainError("Deleted assets cannot update visibility.");
  }

  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Asset ownership lastModifiedAt");

  return rehydrateAsset({
    ...asset,
    visibility: input.visibility,
    sharingPolicyRef: input.sharingPolicyRef,
    ownership: touchOwnership(asset.ownership, input.actorUserId, occurredAt),
  });
}

export function transitionAssetLifecycle(
  asset: Asset,
  nextState: AssetLifecycleState,
  input: {
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
  },
): Asset {
  const normalizedNextState = normalizeLifecycleState(nextState);
  if (!isAssetTransitionAllowed(asset.lifecycle.state, normalizedNextState)) {
    throw new AssetLifecycleTransitionError(asset.lifecycle.state, normalizedNextState);
  }

  if (asset.lifecycle.state === normalizedNextState) {
    return asset;
  }

  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Asset lifecycle transition occurredAt");
  const actorUserId = normalizeRequired(input.actorUserId, "Asset lifecycle actorUserId");

  if (normalizedNextState === AssetLifecycleStates.active) {
    return rehydrateAsset({
      ...asset,
      lifecycle: {
        state: AssetLifecycleStates.active,
      },
      ownership: touchOwnership(asset.ownership, actorUserId, occurredAt),
    });
  }

  if (normalizedNextState === AssetLifecycleStates.archived) {
    return rehydrateAsset({
      ...asset,
      lifecycle: {
        state: AssetLifecycleStates.archived,
        archivedAt: occurredAt,
        archivedBy: actorUserId,
      },
      ownership: touchOwnership(asset.ownership, actorUserId, occurredAt),
    });
  }

  return rehydrateAsset({
    ...asset,
    lifecycle: {
      state: AssetLifecycleStates.deleted,
      archivedAt: asset.lifecycle.archivedAt ?? occurredAt,
      archivedBy: asset.lifecycle.archivedBy ?? actorUserId,
      deletedAt: occurredAt,
      deletedBy: actorUserId,
    },
    ownership: touchOwnership(asset.ownership, actorUserId, occurredAt),
  });
}

export function getCurrentAssetVersion(asset: Asset): AssetVersion {
  const resolved = asset.versions.find((version) => version.versionId === asset.currentVersionId);
  if (!resolved) {
    throw new AssetDomainError(`Asset currentVersionId '${asset.currentVersionId}' does not resolve to a version.`);
  }
  return resolved;
}
