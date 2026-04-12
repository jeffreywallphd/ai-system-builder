export interface AssetPreviewCandidate {
  readonly assetId: string;
  readonly versionId: string;
  readonly mimeType: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly generatedAt: string;
}

export interface ResolvePreviewForAssetRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly versionId?: string;
  readonly preferredMimeTypes?: ReadonlyArray<string>;
  readonly occurredAt?: string;
}

export interface IAssetPreviewPort {
  resolvePreviewForAsset(request: ResolvePreviewForAssetRequest): Promise<AssetPreviewCandidate | undefined>;
}

