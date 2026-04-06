import type { AssetStorageArea } from "../../../domain/assets/AssetDomain";

export const AssetUploadSessionStatuses = Object.freeze({
  pending: "pending",
  completed: "completed",
  incomplete: "incomplete",
});

export type AssetUploadSessionStatus =
  typeof AssetUploadSessionStatuses[keyof typeof AssetUploadSessionStatuses];

export interface AssetUploadSessionRecord {
  readonly uploadSessionId: string;
  readonly workspaceId: string;
  readonly assetId: string;
  readonly actorUserId: string;
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly area: AssetStorageArea;
  readonly expected: {
    readonly fileName: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
  };
  readonly status: AssetUploadSessionStatus;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly finalizedVersionId?: string;
  readonly finalizedContent?: {
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly checksumAlgorithm: "sha256";
    readonly checksumDigest: string;
    readonly originalFileName?: string;
  };
  readonly incompleteReasonCode?: string;
  readonly incompleteReasonMessage?: string;
}

export interface IAssetUploadSessionRepository {
  createUploadSession(session: AssetUploadSessionRecord): Promise<void>;
  findUploadSessionById(uploadSessionId: string): Promise<AssetUploadSessionRecord | undefined>;
  saveUploadSession(session: AssetUploadSessionRecord): Promise<void>;
}
