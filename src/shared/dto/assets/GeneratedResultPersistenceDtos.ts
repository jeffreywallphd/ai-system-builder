import type { AssetVisibility } from "@domain/assets/AssetDomain";
import type { SupportedImageMediaType } from "@domain/image-assets/ImageAssetDomain";
import type { GeneratedResultAssetStatus } from "@domain/image-assets/GeneratedResultAssetDomain";
import type {
  GeneratedResultDerivativeAvailabilityStatus,
  GeneratedResultPreviewKind,
} from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import type {
  PersistenceAuditStamp,
  PersistenceMutationResult,
  PersistenceTenancyMetadata,
  PersistenceVersionMetadata,
} from "../persistence/PersistenceBoundaryDtos";
import { normalizePersistenceOperationKey } from "../persistence/PersistenceBoundaryDtos";

export interface GeneratedResultPersistenceWriteContext {
  readonly actorUserId: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface GeneratedResultPersistenceMutationEnvelope {
  readonly operationKey: string;
  readonly expectedRevision?: number;
  readonly context: GeneratedResultPersistenceWriteContext;
}

export interface GeneratedResultPersistenceRecord extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly resultAssetId: string;
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly runId: string;
  readonly systemId: string;
  readonly workflowId: string;
  readonly workflowTemplateId?: string;
  readonly executionNodeId?: string;
  readonly outputSlot: string;
  readonly inputAssetIds: ReadonlyArray<string>;
  readonly workflowTemplateVersionId?: string;
  readonly workflowTemplateVersionTag?: string;
  readonly systemSnapshotId?: string;
  readonly systemVersionTag?: string;
  readonly parameterSnapshotId?: string;
  readonly selectedNodeId?: string;
  readonly executionAdapterKind?: string;
  readonly executionBackendFamily?: string;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyId?: string;
  readonly sharingPolicyVersion?: string;
  readonly storageInstanceId: string;
  readonly storageBindingReference?: string;
  readonly mediaType?: SupportedImageMediaType;
  readonly status: GeneratedResultAssetStatus;
  readonly pendingSince: string;
  readonly logicalAssetVersionId?: string;
  readonly persistedAt?: string;
  readonly persistedBy?: string;
  readonly previewReadyAt?: string;
  readonly previewReadyBy?: string;
  readonly failedAt?: string;
  readonly failedBy?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
  readonly tenancy: PersistenceTenancyMetadata;
}

export interface GeneratedResultPreviewPersistenceRecord extends PersistenceAuditStamp, PersistenceVersionMetadata {
  readonly derivativeId: string;
  readonly resultAssetId: string;
  readonly resultLogicalAssetVersionId?: string;
  readonly previewKind: GeneratedResultPreviewKind;
  readonly availabilityStatus: GeneratedResultDerivativeAvailabilityStatus;
  readonly isPrimaryPreview: boolean;
  readonly protectedResourceId?: string;
  readonly accessHandle?: string;
  readonly mediaType?: SupportedImageMediaType;
  readonly width?: number;
  readonly height?: number;
  readonly byteSize?: number;
  readonly generatedAt?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly tenancy: PersistenceTenancyMetadata;
}

export type GeneratedResultPersistenceMutationResult<TRecord> = PersistenceMutationResult<TRecord>;

export function normalizeGeneratedResultPersistenceOperationKey(operationKey: string): string {
  return normalizePersistenceOperationKey(operationKey);
}
