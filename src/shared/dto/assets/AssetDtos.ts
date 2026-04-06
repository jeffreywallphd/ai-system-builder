import {
  createAsset,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  rehydrateAsset,
  type Asset,
  type AssetChecksumAlgorithm,
  type AssetKind,
  type AssetLifecycleState,
  type AssetStorageArea,
  type AssetVisibility,
} from "../../../domain/assets/AssetDomain";

export interface AssetSharingPolicyReferenceDto {
  readonly policyId: string;
  readonly policyVersion?: string;
}

export interface StorageInstanceRefDto {
  readonly storageInstanceId: string;
  readonly uri: string;
}

export interface AssetLocationRefDto {
  readonly storageInstance: StorageInstanceRefDto;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
}

export interface ContentDescriptorDto {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: {
    readonly algorithm: AssetChecksumAlgorithm;
    readonly digest: string;
  };
  readonly originalFileName?: string;
}

export interface AssetVersionDto {
  readonly versionId: string;
  readonly revision: number;
  readonly location: AssetLocationRefDto;
  readonly content: ContentDescriptorDto;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface AssetOwnershipMetadataDto {
  readonly workspaceId: string;
  readonly ownerUserId?: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly lastModifiedBy: string;
  readonly lastModifiedAt: string;
}

export interface AssetLifecycleMetadataDto {
  readonly state: AssetLifecycleState;
  readonly archivedAt?: string;
  readonly archivedBy?: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface AssetDto {
  readonly id: string;
  readonly kind: AssetKind;
  readonly ownership: AssetOwnershipMetadataDto;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReferenceDto;
  readonly storageBinding: StorageInstanceRefDto;
  readonly versions: ReadonlyArray<AssetVersionDto>;
  readonly currentVersionId: string;
  readonly lifecycle: AssetLifecycleMetadataDto;
}

export function toAssetDto(value: Asset): AssetDto {
  return Object.freeze({
    id: value.id,
    kind: value.kind,
    ownership: {
      workspaceId: value.ownership.workspaceId,
      ownerUserId: value.ownership.ownerUserId,
      createdBy: value.ownership.createdBy,
      createdAt: value.ownership.createdAt,
      lastModifiedBy: value.ownership.lastModifiedBy,
      lastModifiedAt: value.ownership.lastModifiedAt,
    },
    visibility: value.visibility,
    sharingPolicyRef: value.sharingPolicyRef
      ? {
        policyId: value.sharingPolicyRef.policyId,
        policyVersion: value.sharingPolicyRef.policyVersion,
      }
      : undefined,
    storageBinding: {
      storageInstanceId: value.storageBinding.storageInstanceId,
      uri: value.storageBinding.uri,
    },
    versions: value.versions.map((version) => ({
      versionId: version.versionId,
      revision: version.revision,
      location: {
        storageInstance: {
          storageInstanceId: version.location.storageInstance.storageInstanceId,
          uri: version.location.storageInstance.uri,
        },
        objectKey: version.location.objectKey,
        objectVersionId: version.location.objectVersionId,
        area: version.location.area,
      },
      content: {
        mimeType: version.content.mimeType,
        sizeBytes: version.content.sizeBytes,
        checksum: {
          algorithm: version.content.checksum.algorithm,
          digest: version.content.checksum.digest,
        },
        originalFileName: version.content.originalFileName,
      },
      createdBy: version.createdBy,
      createdAt: version.createdAt,
    })),
    currentVersionId: value.currentVersionId,
    lifecycle: {
      state: value.lifecycle.state,
      archivedAt: value.lifecycle.archivedAt,
      archivedBy: value.lifecycle.archivedBy,
      deletedAt: value.lifecycle.deletedAt,
      deletedBy: value.lifecycle.deletedBy,
    },
  });
}

export function rehydrateAssetFromDto(value: AssetDto): Asset {
  return rehydrateAsset({
    id: value.id,
    kind: value.kind,
    ownership: createAssetOwnershipMetadata({
      workspaceId: value.ownership.workspaceId,
      ownerUserId: value.ownership.ownerUserId,
      createdBy: value.ownership.createdBy,
      createdAt: value.ownership.createdAt,
      lastModifiedBy: value.ownership.lastModifiedBy,
      lastModifiedAt: value.ownership.lastModifiedAt,
    }),
    visibility: value.visibility,
    sharingPolicyRef: value.sharingPolicyRef
      ? {
        policyId: value.sharingPolicyRef.policyId,
        policyVersion: value.sharingPolicyRef.policyVersion,
      }
      : undefined,
    storageBinding: createStorageInstanceRef(value.storageBinding),
    versions: value.versions.map((version) => createAssetVersion({
      versionId: version.versionId,
      revision: version.revision,
      location: {
        storageInstance: createStorageInstanceRef(version.location.storageInstance),
        objectKey: version.location.objectKey,
        objectVersionId: version.location.objectVersionId,
        area: version.location.area,
      },
      content: createContentDescriptor({
        mimeType: version.content.mimeType,
        sizeBytes: version.content.sizeBytes,
        checksum: {
          algorithm: version.content.checksum.algorithm,
          digest: version.content.checksum.digest,
        },
        originalFileName: version.content.originalFileName,
      }),
      createdBy: version.createdBy,
      createdAt: version.createdAt,
    })),
    currentVersionId: value.currentVersionId,
    lifecycle: {
      state: value.lifecycle.state,
      archivedAt: value.lifecycle.archivedAt,
      archivedBy: value.lifecycle.archivedBy,
      deletedAt: value.lifecycle.deletedAt,
      deletedBy: value.lifecycle.deletedBy,
    },
  });
}

export function createAssetDto(input: {
  readonly id: string;
  readonly kind: AssetKind;
  readonly ownership: AssetOwnershipMetadataDto;
  readonly visibility: AssetVisibility;
  readonly sharingPolicyRef?: AssetSharingPolicyReferenceDto;
  readonly storageBinding: StorageInstanceRefDto;
  readonly initialVersion: AssetVersionDto;
}): AssetDto {
  const domainAsset = createAsset({
    id: input.id,
    kind: input.kind,
    ownership: createAssetOwnershipMetadata({
      workspaceId: input.ownership.workspaceId,
      ownerUserId: input.ownership.ownerUserId,
      createdBy: input.ownership.createdBy,
      createdAt: input.ownership.createdAt,
      lastModifiedBy: input.ownership.lastModifiedBy,
      lastModifiedAt: input.ownership.lastModifiedAt,
    }),
    visibility: input.visibility,
    sharingPolicyRef: input.sharingPolicyRef,
    storageBinding: createStorageInstanceRef(input.storageBinding),
    initialVersion: createAssetVersion({
      versionId: input.initialVersion.versionId,
      revision: input.initialVersion.revision,
      location: {
        storageInstance: createStorageInstanceRef(input.initialVersion.location.storageInstance),
        objectKey: input.initialVersion.location.objectKey,
        objectVersionId: input.initialVersion.location.objectVersionId,
        area: input.initialVersion.location.area,
      },
      content: createContentDescriptor(input.initialVersion.content),
      createdBy: input.initialVersion.createdBy,
      createdAt: input.initialVersion.createdAt,
    }),
  });

  return toAssetDto(domainAsset);
}
