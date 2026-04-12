import type {
  ImageAssetFingerprintAlgorithm,
  ImageAssetOriginKind,
  ImageAssetStatus,
  SupportedImageMediaType,
} from "@domain/image-assets/ImageAssetDomain";
import type {
  ResourceVisibility,
  SharingPolicyMode,
} from "@domain/authorization/AuthorizationDomain";
import type {
  PersistenceAuditStamp,
  PersistenceMutationResult,
  PersistenceTenancyMetadata,
  PersistenceVersionMetadata,
} from "../persistence/PersistenceBoundaryDtos";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export interface ImageAssetPersistenceWriteContext {
  readonly actorUserId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ImageAssetPersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: ImageAssetPersistenceWriteContext;
}

export interface ImageAssetPersistenceRecord
  extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly assetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly originKind: ImageAssetOriginKind;
  readonly visibility: ResourceVisibility;
  readonly sharingPolicyMode: SharingPolicyMode;
  readonly sharingPolicyId?: string;
  readonly sharingPolicyVersion?: string;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly mediaType: SupportedImageMediaType;
  readonly originalFilename: string;
  readonly normalizedFilename: string;
  readonly sizeBytes: number;
  readonly fingerprintAlgorithm: ImageAssetFingerprintAlgorithm;
  readonly fingerprintDigest: string;
  readonly lifecycleStatus: ImageAssetStatus;
  readonly lifecycleIngestedAt?: string;
  readonly lifecycleFailedAt?: string;
  readonly lifecycleFailedBy?: string;
  readonly lifecycleFailureReason?: string;
  readonly lifecycleArchivedAt?: string;
  readonly lifecycleArchivedBy?: string;
  readonly lifecycleDeletedAt?: string;
  readonly lifecycleDeletedBy?: string;
  readonly latestObjectKey?: string;
  readonly latestObjectVersionId?: string;
  readonly previewAssetId?: string;
  readonly previewMediaType?: SupportedImageMediaType;
  readonly upstreamAssetIds?: ReadonlyArray<string>;
  readonly sourceRunId?: string;
  readonly generationOperationId?: string;
  readonly tenancy: PersistenceTenancyMetadata;
}

export interface ImageAssetUploadSessionPersistenceRecord
  extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly uploadSessionId: string;
  readonly assetId: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly expectedFileName: string;
  readonly expectedMediaType: SupportedImageMediaType;
  readonly expectedSizeBytes: number;
  readonly uploadEndpoint: string;
  readonly expiresAt: string;
  readonly uploadedAt?: string;
  readonly finalizedAt?: string;
  readonly canceledAt?: string;
  readonly objectKey?: string;
  readonly objectVersionId?: string;
  readonly checksumAlgorithm?: ImageAssetFingerprintAlgorithm;
  readonly checksumDigest?: string;
  readonly tenancy: PersistenceTenancyMetadata;
}

export type ImageAssetPersistenceMutationResult<TRecord> = PersistenceMutationResult<TRecord>;

export function normalizeImageAssetPersistenceOperationKey(operationKey: string): string {
  return normalizePersistenceOperationKey(operationKey);
}
