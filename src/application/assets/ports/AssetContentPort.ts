import type { AssetStorageArea } from "@domain/assets/AssetDomain";

export interface AssetContentPointer {
  readonly storageInstanceId: string;
  readonly objectKey: string;
  readonly objectVersionId?: string;
  readonly area: AssetStorageArea;
}

export interface AssetContentDescriptorInput {
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly checksum: {
    readonly algorithm: "sha256" | "sha512" | "md5";
    readonly digest: string;
  };
  readonly originalFileName?: string;
}

export interface FinalizeContentUploadRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly uploadSessionId: string;
  readonly pointer: AssetContentPointer;
  readonly expectedContent: AssetContentDescriptorInput;
  readonly occurredAt?: string;
}

export interface FinalizeContentUploadResult {
  readonly pointer: AssetContentPointer;
  readonly verifiedContent: AssetContentDescriptorInput;
  readonly finalizedAt: string;
}

export interface CreateProtectedContentReadGrantRequest {
  readonly workspaceId: string;
  readonly actorUserId: string;
  readonly assetId: string;
  readonly versionId: string;
  readonly pointer: AssetContentPointer;
  readonly expiresInSeconds: number;
  readonly correlationId?: string;
  readonly occurredAt?: string;
}

export interface ProtectedContentReadGrant {
  readonly grantToken: string;
  readonly expiresAt: string;
}

export interface IAssetContentPort {
  finalizeContentUpload(request: FinalizeContentUploadRequest): Promise<FinalizeContentUploadResult>;
  createProtectedContentReadGrant(
    request: CreateProtectedContentReadGrantRequest,
  ): Promise<ProtectedContentReadGrant>;
}


