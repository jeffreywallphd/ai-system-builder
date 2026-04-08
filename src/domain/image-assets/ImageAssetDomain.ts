import {
  ResourceVisibilities,
  SharingPolicyModes,
  type ResourceVisibility,
  type SharingPolicyMode,
} from "@domain/authorization/AuthorizationDomain";

export class ImageAssetDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageAssetDomainError";
  }
}

export class ImageAssetStatusTransitionError extends ImageAssetDomainError {
  constructor(fromStatus: ImageAssetStatus, toStatus: ImageAssetStatus) {
    super(`Image asset status cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "ImageAssetStatusTransitionError";
  }
}

export const ImageAssetOriginKinds = Object.freeze({
  uploadedSource: "uploaded-source",
  generatedResult: "generated-result",
} as const);

export type ImageAssetOriginKind =
  typeof ImageAssetOriginKinds[keyof typeof ImageAssetOriginKinds];

export const ImageAssetStatuses = Object.freeze({
  ingesting: "ingesting",
  available: "available",
  failed: "failed",
  archived: "archived",
  deleted: "deleted",
} as const);

export type ImageAssetStatus = typeof ImageAssetStatuses[keyof typeof ImageAssetStatuses];

export const ImageAssetFingerprintAlgorithms = Object.freeze({
  sha256: "sha256",
  sha512: "sha512",
  blake3: "blake3",
} as const);

export type ImageAssetFingerprintAlgorithm =
  typeof ImageAssetFingerprintAlgorithms[keyof typeof ImageAssetFingerprintAlgorithms];

export const SupportedImageMediaTypes = Object.freeze([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/avif",
  "image/heic",
  "image/heif",
] as const);

export type SupportedImageMediaType = (typeof SupportedImageMediaTypes)[number];

export const ImageAssetLifecycleTransitions: Readonly<
  Record<ImageAssetStatus, ReadonlyArray<ImageAssetStatus>>
> = Object.freeze({
  [ImageAssetStatuses.ingesting]: Object.freeze([
    ImageAssetStatuses.available,
    ImageAssetStatuses.failed,
    ImageAssetStatuses.deleted,
  ]),
  [ImageAssetStatuses.available]: Object.freeze([
    ImageAssetStatuses.archived,
    ImageAssetStatuses.deleted,
  ]),
  [ImageAssetStatuses.failed]: Object.freeze([
    ImageAssetStatuses.ingesting,
    ImageAssetStatuses.deleted,
  ]),
  [ImageAssetStatuses.archived]: Object.freeze([
    ImageAssetStatuses.available,
    ImageAssetStatuses.deleted,
  ]),
  [ImageAssetStatuses.deleted]: Object.freeze([]),
});

export interface ImageAssetFingerprint {
  readonly algorithm: ImageAssetFingerprintAlgorithm;
  readonly digest: string;
}

export interface ImageAssetSharingPolicy {
  readonly mode: SharingPolicyMode;
  readonly policyId?: string;
  readonly policyVersion?: string;
}

export interface ImageAssetLifecycleMetadata {
  readonly status: ImageAssetStatus;
  readonly ingestedAt?: string;
  readonly failedAt?: string;
  readonly failedBy?: string;
  readonly failureReason?: string;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface ImageAssetLineageMetadata {
  readonly upstreamAssetIds: ReadonlyArray<string>;
  readonly sourceRunId?: string;
  readonly generationOperationId?: string;
}

export interface ImageAsset {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly originKind: ImageAssetOriginKind;
  readonly mediaType: SupportedImageMediaType;
  readonly originalFilename: string;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly fingerprint: ImageAssetFingerprint;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicy: ImageAssetSharingPolicy;
  readonly lifecycle: ImageAssetLifecycleMetadata;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lineage?: ImageAssetLineageMetadata;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ImageAssetDomainError(`${field} is required.`);
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
    throw new ImageAssetDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeAssetId(value: string): string {
  const normalized = normalizeRequired(value, "Image asset assetId");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,191}$/.test(normalized)) {
    throw new ImageAssetDomainError(
      "Image asset assetId must be 3-192 characters and use letters, numbers, '.', '_', ':', or '-'.",
    );
  }
  return normalized;
}

function normalizeWorkspaceId(value: string): string {
  const normalized = normalizeRequired(value, "Image asset workspaceId");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,191}$/.test(normalized)) {
    throw new ImageAssetDomainError(
      "Image asset workspaceId must be 3-192 characters and use letters, numbers, '.', '_', ':', or '-'.",
    );
  }
  return normalized;
}

function normalizeStorageInstanceId(value: string): string {
  const normalized = normalizeRequired(value, "Image asset storageInstanceId");
  if (!/^[a-z0-9][a-z0-9-]{2,126}$/.test(normalized)) {
    throw new ImageAssetDomainError(
      "Image asset storageInstanceId must be lowercase alphanumeric with optional '-' and 3-127 characters.",
    );
  }
  return normalized;
}

function normalizeStorageBindingReference(
  value: string | undefined,
  storageInstanceId: string,
): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  if (/^[a-zA-Z]:\\/.test(normalized) || normalized.includes("\\") || normalized.startsWith("/")) {
    throw new ImageAssetDomainError("Image asset storageBindingReference must be a logical storage reference, not a filesystem path.");
  }

  const match = /^storage-instance:\/\/([a-z0-9][a-z0-9-]{2,126})(?:\/[a-z0-9-]+)?$/.exec(normalized);
  if (!match) {
    throw new ImageAssetDomainError(
      "Image asset storageBindingReference must use 'storage-instance://<id>' or 'storage-instance://<id>/<area>' format.",
    );
  }

  if (match[1] !== storageInstanceId) {
    throw new ImageAssetDomainError(
      "Image asset storageBindingReference must match storageInstanceId.",
    );
  }

  return normalized;
}

function normalizeOriginKind(value: ImageAssetOriginKind): ImageAssetOriginKind {
  if (!Object.values(ImageAssetOriginKinds).includes(value)) {
    throw new ImageAssetDomainError(`Image asset originKind '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeMediaType(value: string): SupportedImageMediaType {
  const normalized = normalizeRequired(value, "Image asset mediaType").toLowerCase();
  if (!SupportedImageMediaTypes.includes(normalized as SupportedImageMediaType)) {
    throw new ImageAssetDomainError(
      `Image asset mediaType '${value}' is not supported.`,
    );
  }
  return normalized as SupportedImageMediaType;
}

function normalizeOriginalFilename(value: string): string {
  const normalized = normalizeRequired(value, "Image asset originalFilename");
  if (normalized.length > 255) {
    throw new ImageAssetDomainError("Image asset originalFilename must be 255 characters or fewer.");
  }
  return normalized;
}

function normalizeNormalizedFilename(value: string): string {
  const normalized = normalizeRequired(value, "Image asset normalizedFilename").toLowerCase();
  if (normalized.length > 255) {
    throw new ImageAssetDomainError("Image asset normalizedFilename must be 255 characters or fewer.");
  }
  if (normalized.includes("/") || normalized.includes("\\")) {
    throw new ImageAssetDomainError("Image asset normalizedFilename cannot include path separators.");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(normalized)) {
    throw new ImageAssetDomainError(
      "Image asset normalizedFilename must start with a lowercase alphanumeric character and only use lowercase alphanumeric, '.', '_', or '-'.",
    );
  }
  return normalized;
}

function normalizeSizeBytes(value: number): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new ImageAssetDomainError("Image asset sizeBytes must be an integer >= 1.");
  }
  return value;
}

function normalizeFingerprintAlgorithm(
  value: ImageAssetFingerprintAlgorithm,
): ImageAssetFingerprintAlgorithm {
  if (!Object.values(ImageAssetFingerprintAlgorithms).includes(value)) {
    throw new ImageAssetDomainError(`Image asset fingerprint algorithm '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeFingerprint(input: ImageAssetFingerprint): ImageAssetFingerprint {
  const algorithm = normalizeFingerprintAlgorithm(input.algorithm);
  const digest = normalizeRequired(input.digest, "Image asset fingerprint digest").toLowerCase();

  if (!/^[a-f0-9]+$/.test(digest)) {
    throw new ImageAssetDomainError("Image asset fingerprint digest must be lowercase hexadecimal.");
  }

  const expectedLength = algorithm === ImageAssetFingerprintAlgorithms.sha512 ? 128 : 64;
  if (digest.length !== expectedLength) {
    throw new ImageAssetDomainError(
      `Image asset fingerprint digest length must be ${expectedLength} for algorithm '${algorithm}'.`,
    );
  }

  return Object.freeze({
    algorithm,
    digest,
  });
}

function normalizeVisibility(value: ResourceVisibility): ResourceVisibility {
  if (!Object.values(ResourceVisibilities).includes(value)) {
    throw new ImageAssetDomainError(`Image asset visibility '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSharingPolicyMode(value: SharingPolicyMode): SharingPolicyMode {
  if (!Object.values(SharingPolicyModes).includes(value)) {
    throw new ImageAssetDomainError(`Image asset sharingPolicy mode '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeSharingPolicy(
  input: ImageAssetSharingPolicy | undefined,
  visibility: ResourceVisibility,
): ImageAssetSharingPolicy {
  const defaultMode = visibility === ResourceVisibilities.private
    ? SharingPolicyModes.ownerOnly
    : visibility === ResourceVisibilities.workspace
      ? SharingPolicyModes.workspaceMembers
      : visibility === ResourceVisibilities.shared
        ? SharingPolicyModes.explicit
        : SharingPolicyModes.published;

  const mode = normalizeSharingPolicyMode(input?.mode ?? defaultMode);
  const policyId = normalizeOptional(input?.policyId);
  const policyVersion = normalizeOptional(input?.policyVersion);

  return Object.freeze({
    mode,
    policyId,
    policyVersion,
  });
}

function normalizeStatus(value: ImageAssetStatus): ImageAssetStatus {
  if (!Object.values(ImageAssetStatuses).includes(value)) {
    throw new ImageAssetDomainError(`Image asset lifecycle status '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeLifecycle(input: ImageAssetLifecycleMetadata): ImageAssetLifecycleMetadata {
  return Object.freeze({
    status: normalizeStatus(input.status),
    ingestedAt: input.ingestedAt ? normalizeTimestamp(input.ingestedAt, "Image asset lifecycle ingestedAt") : undefined,
    failedAt: input.failedAt ? normalizeTimestamp(input.failedAt, "Image asset lifecycle failedAt") : undefined,
    failedBy: normalizeOptional(input.failedBy),
    failureReason: normalizeOptional(input.failureReason),
    archivedAt: input.archivedAt ? normalizeTimestamp(input.archivedAt, "Image asset lifecycle archivedAt") : undefined,
    archivedBy: normalizeOptional(input.archivedBy),
    deletedAt: input.deletedAt ? normalizeTimestamp(input.deletedAt, "Image asset lifecycle deletedAt") : undefined,
    deletedBy: normalizeOptional(input.deletedBy),
  });
}

function normalizeLineage(
  input: ImageAssetLineageMetadata | undefined,
  assetId: string,
): ImageAssetLineageMetadata | undefined {
  if (!input) {
    return undefined;
  }

  const upstreamAssetIds = [...new Set(
    input.upstreamAssetIds.map((value) => normalizeAssetId(value)),
  )];

  if (upstreamAssetIds.some((value) => value === assetId)) {
    throw new ImageAssetDomainError("Image asset lineage upstreamAssetIds cannot include the assetId itself.");
  }

  return Object.freeze({
    upstreamAssetIds: Object.freeze(upstreamAssetIds),
    sourceRunId: normalizeOptional(input.sourceRunId),
    generationOperationId: normalizeOptional(input.generationOperationId),
  });
}

function assertVisibilityOwnershipInvariants(value: {
  readonly ownerUserId?: string;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicy: ImageAssetSharingPolicy;
}): void {
  if (!value.ownerUserId && value.visibility === ResourceVisibilities.private) {
    throw new ImageAssetDomainError("Private image assets require ownerUserId.");
  }

  if (value.visibility === ResourceVisibilities.private) {
    if (value.sharingPolicy.mode !== SharingPolicyModes.ownerOnly) {
      throw new ImageAssetDomainError("Private image assets require sharingPolicy.mode='owner-only'.");
    }
    if (value.sharingPolicy.policyId) {
      throw new ImageAssetDomainError("Private image assets cannot include sharingPolicy.policyId.");
    }
  }

  if (value.visibility === ResourceVisibilities.workspace) {
    if (value.sharingPolicy.mode !== SharingPolicyModes.workspaceMembers) {
      throw new ImageAssetDomainError("Workspace-visible image assets require sharingPolicy.mode='workspace-members'.");
    }
    if (value.sharingPolicy.policyId) {
      throw new ImageAssetDomainError("Workspace-visible image assets cannot include sharingPolicy.policyId.");
    }
  }

  if (value.visibility === ResourceVisibilities.shared) {
    if (value.sharingPolicy.mode !== SharingPolicyModes.explicit) {
      throw new ImageAssetDomainError("Shared image assets require sharingPolicy.mode='explicit'.");
    }
    if (!value.sharingPolicy.policyId) {
      throw new ImageAssetDomainError("Shared image assets require sharingPolicy.policyId.");
    }
  }

  if (value.visibility === ResourceVisibilities.published) {
    if (value.sharingPolicy.mode !== SharingPolicyModes.published) {
      throw new ImageAssetDomainError("Published image assets require sharingPolicy.mode='published'.");
    }
    if (!value.sharingPolicy.policyId) {
      throw new ImageAssetDomainError("Published image assets require sharingPolicy.policyId.");
    }
  }
}

function assertLifecycleStateInvariants(value: ImageAssetLifecycleMetadata): void {
  if (value.status === ImageAssetStatuses.ingesting) {
    if (value.failedAt || value.failedBy || value.failureReason || value.archivedAt || value.archivedBy || value.deletedAt || value.deletedBy) {
      throw new ImageAssetDomainError("Ingesting image assets cannot include failed, archived, or deleted lifecycle metadata.");
    }
    return;
  }

  if (value.status === ImageAssetStatuses.available) {
    if (!value.ingestedAt) {
      throw new ImageAssetDomainError("Available image assets must include ingestedAt.");
    }
    if (value.failedAt || value.failedBy || value.failureReason || value.archivedAt || value.archivedBy || value.deletedAt || value.deletedBy) {
      throw new ImageAssetDomainError("Available image assets cannot include failed, archived, or deleted lifecycle metadata.");
    }
    return;
  }

  if (value.status === ImageAssetStatuses.failed) {
    if (!value.failedAt || !value.failedBy || !value.failureReason) {
      throw new ImageAssetDomainError("Failed image assets must include failedAt, failedBy, and failureReason.");
    }
    if (value.archivedAt || value.archivedBy || value.deletedAt || value.deletedBy) {
      throw new ImageAssetDomainError("Failed image assets cannot include archived or deleted lifecycle metadata.");
    }
    return;
  }

  if (value.status === ImageAssetStatuses.archived) {
    if (!value.ingestedAt) {
      throw new ImageAssetDomainError("Archived image assets must include ingestedAt.");
    }
    if (!value.archivedAt || !value.archivedBy) {
      throw new ImageAssetDomainError("Archived image assets must include archivedAt and archivedBy.");
    }
    if (value.deletedAt || value.deletedBy) {
      throw new ImageAssetDomainError("Archived image assets cannot include deletedAt or deletedBy.");
    }
    return;
  }

  if (!value.deletedAt || !value.deletedBy) {
    throw new ImageAssetDomainError("Deleted image assets must include deletedAt and deletedBy.");
  }

  if (value.archivedAt && new Date(value.deletedAt).getTime() < new Date(value.archivedAt).getTime()) {
    throw new ImageAssetDomainError("Image asset deletedAt cannot be earlier than archivedAt.");
  }
}

function assertUpdatedAtInvariant(createdAt: string, updatedAt: string): void {
  if (new Date(updatedAt).getTime() < new Date(createdAt).getTime()) {
    throw new ImageAssetDomainError("Image asset updatedAt cannot be earlier than createdAt.");
  }
}

function isStatusTransitionAllowed(from: ImageAssetStatus, to: ImageAssetStatus): boolean {
  if (from === to) {
    return true;
  }
  return ImageAssetLifecycleTransitions[from].includes(to);
}

function assertImageAssetInvariants(asset: ImageAsset): void {
  assertVisibilityOwnershipInvariants(asset);
  assertLifecycleStateInvariants(asset.lifecycle);
  assertUpdatedAtInvariant(asset.createdAt, asset.updatedAt);
}

export function createImageAsset(input: {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly originKind: ImageAssetOriginKind;
  readonly mediaType: string;
  readonly originalFilename: string;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly fingerprint: ImageAssetFingerprint;
  readonly visibility?: ResourceVisibility;
  readonly sharingPolicy?: ImageAssetSharingPolicy;
  readonly createdBy: string;
  readonly createdAt?: Date | string;
  readonly lastModifiedBy?: string;
  readonly updatedAt?: Date | string;
  readonly lifecycleStatus?: ImageAssetStatus;
  readonly lifecycleFailureReason?: string;
  readonly lineage?: ImageAssetLineageMetadata;
}): ImageAsset {
  const createdAt = normalizeTimestamp(input.createdAt ?? new Date(), "Image asset createdAt");
  const updatedAt = normalizeTimestamp(input.updatedAt ?? createdAt, "Image asset updatedAt");
  const lifecycleStatus = normalizeStatus(input.lifecycleStatus ?? ImageAssetStatuses.ingesting);
  const lifecycle: ImageAssetLifecycleMetadata = lifecycleStatus === ImageAssetStatuses.ingesting
    ? { status: ImageAssetStatuses.ingesting }
    : lifecycleStatus === ImageAssetStatuses.available
      ? { status: ImageAssetStatuses.available, ingestedAt: createdAt }
      : lifecycleStatus === ImageAssetStatuses.failed
        ? {
          status: ImageAssetStatuses.failed,
          failedAt: createdAt,
          failedBy: input.createdBy,
          failureReason: normalizeRequired(
            input.lifecycleFailureReason ?? "ingestion-failed",
            "Image asset lifecycleFailureReason",
          ),
        }
        : lifecycleStatus === ImageAssetStatuses.archived
          ? {
            status: ImageAssetStatuses.archived,
            ingestedAt: createdAt,
            archivedAt: createdAt,
            archivedBy: input.createdBy,
          }
          : {
            status: ImageAssetStatuses.deleted,
            deletedAt: createdAt,
            deletedBy: input.createdBy,
          };

  return rehydrateImageAsset({
    assetId: input.assetId,
    workspaceId: input.workspaceId,
    ownerUserId: input.ownerUserId,
    storageInstanceId: input.storageInstanceId,
    storageBindingReference: input.storageBindingReference,
    originKind: input.originKind,
    mediaType: input.mediaType,
    originalFilename: input.originalFilename,
    normalizedFilename: input.normalizedFilename,
    sizeBytes: input.sizeBytes,
    fingerprint: input.fingerprint,
    visibility: input.visibility ?? ResourceVisibilities.private,
    sharingPolicy: input.sharingPolicy,
    lifecycle,
    createdBy: input.createdBy,
    lastModifiedBy: input.lastModifiedBy ?? input.createdBy,
    createdAt,
    updatedAt,
    lineage: input.lineage,
  });
}

export function rehydrateImageAsset(input: {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly originKind: ImageAssetOriginKind;
  readonly mediaType: string;
  readonly originalFilename: string;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly fingerprint: ImageAssetFingerprint;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicy?: ImageAssetSharingPolicy;
  readonly lifecycle: ImageAssetLifecycleMetadata;
  readonly createdBy: string;
  readonly lastModifiedBy: string;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
  readonly lineage?: ImageAssetLineageMetadata;
}): ImageAsset {
  const storageInstanceId = normalizeStorageInstanceId(input.storageInstanceId);
  const visibility = normalizeVisibility(input.visibility);
  const sharingPolicy = normalizeSharingPolicy(input.sharingPolicy, visibility);
  const assetId = normalizeAssetId(input.assetId);

  const asset: ImageAsset = Object.freeze({
    assetId,
    workspaceId: normalizeWorkspaceId(input.workspaceId),
    ownerUserId: normalizeOptional(input.ownerUserId),
    storageInstanceId,
    storageBindingReference: normalizeStorageBindingReference(input.storageBindingReference, storageInstanceId),
    originKind: normalizeOriginKind(input.originKind),
    mediaType: normalizeMediaType(input.mediaType),
    originalFilename: normalizeOriginalFilename(input.originalFilename),
    normalizedFilename: normalizeNormalizedFilename(input.normalizedFilename),
    sizeBytes: normalizeSizeBytes(input.sizeBytes),
    fingerprint: normalizeFingerprint(input.fingerprint),
    visibility,
    sharingPolicy,
    lifecycle: normalizeLifecycle(input.lifecycle),
    createdBy: normalizeRequired(input.createdBy, "Image asset createdBy"),
    lastModifiedBy: normalizeRequired(input.lastModifiedBy, "Image asset lastModifiedBy"),
    createdAt: normalizeTimestamp(input.createdAt, "Image asset createdAt"),
    updatedAt: normalizeTimestamp(input.updatedAt, "Image asset updatedAt"),
    lineage: normalizeLineage(input.lineage, assetId),
  });

  assertImageAssetInvariants(asset);
  return asset;
}

export function transitionImageAssetStatus(
  asset: ImageAsset,
  input: {
    readonly nextStatus: ImageAssetStatus;
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
    readonly failureReason?: string;
  },
): ImageAsset {
  const nextStatus = normalizeStatus(input.nextStatus);
  if (!isStatusTransitionAllowed(asset.lifecycle.status, nextStatus)) {
    throw new ImageAssetStatusTransitionError(asset.lifecycle.status, nextStatus);
  }

  if (asset.lifecycle.status === nextStatus) {
    return asset;
  }

  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Image asset lifecycle occurredAt");
  const actorUserId = normalizeRequired(input.actorUserId, "Image asset lifecycle actorUserId");
  const baseLifecycle = asset.lifecycle;

  const nextLifecycle: ImageAssetLifecycleMetadata = nextStatus === ImageAssetStatuses.ingesting
    ? {
      status: ImageAssetStatuses.ingesting,
    }
    : nextStatus === ImageAssetStatuses.available
      ? {
        status: ImageAssetStatuses.available,
        ingestedAt: baseLifecycle.ingestedAt ?? occurredAt,
      }
      : nextStatus === ImageAssetStatuses.failed
        ? {
          status: ImageAssetStatuses.failed,
          failedAt: occurredAt,
          failedBy: actorUserId,
          failureReason: normalizeRequired(
            input.failureReason ?? baseLifecycle.failureReason ?? "processing-failed",
            "Image asset lifecycle failureReason",
          ),
          ingestedAt: baseLifecycle.ingestedAt,
        }
        : nextStatus === ImageAssetStatuses.archived
          ? {
            status: ImageAssetStatuses.archived,
            ingestedAt: baseLifecycle.ingestedAt ?? occurredAt,
            archivedAt: occurredAt,
            archivedBy: actorUserId,
          }
          : {
            status: ImageAssetStatuses.deleted,
            ingestedAt: baseLifecycle.ingestedAt,
            archivedAt: baseLifecycle.archivedAt,
            archivedBy: baseLifecycle.archivedBy,
            deletedAt: occurredAt,
            deletedBy: actorUserId,
          };

  return rehydrateImageAsset({
    ...asset,
    lifecycle: nextLifecycle,
    lastModifiedBy: actorUserId,
    updatedAt: occurredAt,
  });
}

export function updateImageAssetVisibility(
  asset: ImageAsset,
  input: {
    readonly visibility: ResourceVisibility;
    readonly sharingPolicy?: ImageAssetSharingPolicy;
    readonly actorUserId: string;
    readonly occurredAt?: Date | string;
  },
): ImageAsset {
  if (asset.lifecycle.status === ImageAssetStatuses.deleted) {
    throw new ImageAssetDomainError("Deleted image assets cannot update visibility.");
  }

  const occurredAt = normalizeTimestamp(input.occurredAt ?? new Date(), "Image asset updatedAt");
  const actorUserId = normalizeRequired(input.actorUserId, "Image asset actorUserId");

  return rehydrateImageAsset({
    ...asset,
    visibility: input.visibility,
    sharingPolicy: input.sharingPolicy,
    lastModifiedBy: actorUserId,
    updatedAt: occurredAt,
  });
}
