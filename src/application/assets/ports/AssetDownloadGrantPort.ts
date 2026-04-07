import type { AssetStorageArea } from "@domain/assets/AssetDomain";
import type { AssetDownloadPurpose } from "../use-cases/AssetServiceContracts";

export interface IssueAssetDownloadGrantRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDispositionFileName?: string;
  readonly purpose: AssetDownloadPurpose;
  readonly expiresInSeconds: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface IssueAssetDownloadGrantResult {
  readonly contentToken: string;
  readonly expiresAt: string;
}

export interface ResolveAssetDownloadGrantRequest {
  readonly contentToken: string;
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly occurredAt?: string;
}

export interface AssetDownloadGrantClaims {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly contentDispositionFileName?: string;
  readonly purpose: AssetDownloadPurpose;
  readonly expiresAt: string;
}

export interface IAssetDownloadGrantPort {
  issueDownloadGrant(request: IssueAssetDownloadGrantRequest): Promise<IssueAssetDownloadGrantResult>;
  resolveDownloadGrant(request: ResolveAssetDownloadGrantRequest): Promise<AssetDownloadGrantClaims | undefined>;
}


