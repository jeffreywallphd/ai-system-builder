export interface AssetMediaMetadata {
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
  readonly frameCount?: number;
  readonly colorSpace?: string;
}

export interface ResolveAssetMediaMetadataRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly mimeType: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly occurredAt?: string;
}

export interface IAssetMediaPort {
  resolveAssetMediaMetadata(
    request: ResolveAssetMediaMetadataRequest,
  ): Promise<AssetMediaMetadata | undefined>;
}

