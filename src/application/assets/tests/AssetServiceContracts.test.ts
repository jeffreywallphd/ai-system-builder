import { describe, expect, it } from "bun:test";
import {
  AssetDownloadPurposes,
  validateAuthorizeAssetDownloadRequest,
  validateFinalizeAssetUploadRequest,
  validateListAssetsQuery,
  validateRegisterAssetRequest,
  validateRegisterGeneratedOutputRequest,
} from "../use-cases/AssetServiceContracts";

describe("AssetServiceContracts", () => {
  it("normalizes register asset requests with logical ids and object keys", () => {
    const request = validateRegisterAssetRequest({
      actorUserId: " user-owner ",
      workspaceId: " workspace-a ",
      operationKey: " op:asset:register:1 ",
      correlationId: " corr-asset-register-1 ",
      occurredAt: "2026-04-06T12:00:00.000Z",
      assetId: "asset-upload-001",
      kind: "uploaded-file",
      ownerUserId: " user-owner ",
      visibility: "private",
      storageInstanceId: "workspace-storage-a",
      initialVersion: {
        versionId: "asset-upload-001:v1",
        storageInstanceId: "workspace-storage-a",
        objectKey: "workspace-a/input/asset-upload-001/v1",
        area: "input",
        content: {
          mimeType: "IMAGE/PNG",
          sizeBytes: 42,
          checksum: {
            algorithm: "sha256",
            digest: "A".repeat(64),
          },
        },
      },
    });

    expect(request.actorUserId).toBe("user-owner");
    expect(request.workspaceId).toBe("workspace-a");
    expect(request.operationKey).toBe("op:asset:register:1");
    expect(request.initialVersion.objectKey).toBe("workspace-a/input/asset-upload-001/v1");
    expect(request.initialVersion.content.mimeType).toBe("image/png");
    expect(request.initialVersion.content.checksum.digest).toBe("a".repeat(64));
    expect(Object.isFrozen(request)).toBeTrue();
  });

  it("rejects filesystem-like object keys in asset registration", () => {
    expect(() => validateRegisterAssetRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:register:2",
      assetId: "asset-upload-002",
      kind: "uploaded-file",
      visibility: "workspace",
      storageInstanceId: "workspace-storage-a",
      initialVersion: {
        versionId: "asset-upload-002:v1",
        storageInstanceId: "workspace-storage-a",
        objectKey: "C:/temp/file.png",
        area: "input",
        content: {
          mimeType: "image/png",
          sizeBytes: 1,
          checksum: {
            algorithm: "sha256",
            digest: "b".repeat(64),
          },
        },
      },
    })).toThrow("objectKey");
  });

  it("validates list query pagination boundaries", () => {
    const query = validateListAssetsQuery({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      limit: 20,
      offset: 0,
    });

    expect(query.limit).toBe(20);
    expect(query.offset).toBe(0);

    expect(() => validateListAssetsQuery({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      limit: 0,
    })).toThrow("limit");
  });

  it("defaults finalize upload requests to set current version", () => {
    const request = validateFinalizeAssetUploadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:finalize:1",
      assetId: "asset-upload-001",
      uploadSessionId: "upload-session-1",
      version: {
        versionId: "asset-upload-001:v2",
        storageInstanceId: "workspace-storage-a",
        objectKey: "workspace-a/input/asset-upload-001/v2",
        area: "input",
        content: {
          mimeType: "image/png",
          sizeBytes: 52,
          checksum: {
            algorithm: "sha256",
            digest: "c".repeat(64),
          },
        },
      },
    });

    expect(request.setAsCurrentVersion).toBeTrue();
  });

  it("validates download authorization request lifetimes", () => {
    const request = validateAuthorizeAssetDownloadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      assetId: "asset-upload-001",
      purpose: AssetDownloadPurposes.download,
      expiresInSeconds: 60,
    });

    expect(request.expiresInSeconds).toBe(60);

    expect(() => validateAuthorizeAssetDownloadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      assetId: "asset-upload-001",
      purpose: AssetDownloadPurposes.download,
      expiresInSeconds: 0,
    })).toThrow("expiresInSeconds");
  });

  it("normalizes generated output lineage inputs", () => {
    const request = validateRegisterGeneratedOutputRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:output:1",
      assetId: "asset-output-001",
      visibility: "workspace",
      storageInstanceId: "workspace-storage-a",
      outputVersion: {
        versionId: "asset-output-001:v1",
        storageInstanceId: "workspace-storage-a",
        objectKey: "workspace-a/output/asset-output-001/v1",
        area: "output",
        content: {
          mimeType: "application/json",
          sizeBytes: 75,
          checksum: {
            algorithm: "sha256",
            digest: "d".repeat(64),
          },
        },
      },
      lineage: [
        {
          sourceAssetId: " asset-upload-001 ",
          sourceAssetVersionId: " asset-upload-001:v2 ",
          relation: " derived-from ",
        },
      ],
    });

    expect(request.lineage[0]?.sourceAssetId).toBe("asset-upload-001");
    expect(request.lineage[0]?.sourceAssetVersionId).toBe("asset-upload-001:v2");
    expect(request.lineage[0]?.relation).toBe("derived-from");
  });
});
