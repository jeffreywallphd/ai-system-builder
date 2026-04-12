import { describe, expect, it } from "bun:test";
import {
  AssetDownloadPurposes,
  validateBeginAssetUploadRequest,
  validateAuthorizeAssetDownloadRequest,
  validateFinalizeAssetUploadRequest,
  validateGetAssetByIdQuery,
  validateListAssetsQuery,
  validateOpenAuthorizedAssetDownloadStreamRequest,
  validateRegisterAssetRequest,
  validateRegisterGeneratedOutputRequest,
  validateResolveAssetPreviewQuery,
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

  it("defaults register visibility when owner is omitted", () => {
    const request = validateRegisterAssetRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:register:default-visibility",
      assetId: "asset-upload-default-001",
      kind: "uploaded-file",
      storageInstanceId: "workspace-storage-a",
      initialVersion: {
        versionId: "asset-upload-default-001:v1",
        storageInstanceId: "workspace-storage-a",
        objectKey: "workspace-a/input/asset-upload-default-001/v1",
        area: "input",
        content: {
          mimeType: "image/png",
          sizeBytes: 10,
          checksum: {
            algorithm: "sha256",
            digest: "e".repeat(64),
          },
        },
      },
    });

    expect(request.visibility).toBe("workspace");
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
      scope: "all",
      createdByUserId: " user-owner ",
      limit: 20,
      offset: 0,
    });

    expect(query.scope).toBe("all");
    expect(query.createdByUserId).toBe("user-owner");
    expect(query.limit).toBe(20);
    expect(query.offset).toBe(0);

    expect(() => validateListAssetsQuery({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      limit: 0,
    })).toThrow("limit");

    expect(() => validateListAssetsQuery({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      scope: "invalid" as "private",
    })).toThrow("scope");
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
      fileNameHint: " image.png ",
      expiresInSeconds: 60,
    });

    expect(request.expiresInSeconds).toBe(60);
    expect(request.fileNameHint).toBe("image.png");

    expect(() => validateAuthorizeAssetDownloadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      assetId: "asset-upload-001",
      purpose: AssetDownloadPurposes.download,
      expiresInSeconds: 0,
    })).toThrow("expiresInSeconds");
  });

  it("validates authorized stream-open requests", () => {
    const request = validateOpenAuthorizedAssetDownloadStreamRequest({
      actorUserId: " user-owner ",
      workspaceId: " workspace-a ",
      assetId: " asset-upload-001 ",
      contentToken: " token-123 ",
    });

    expect(request.actorUserId).toBe("user-owner");
    expect(request.workspaceId).toBe("workspace-a");
    expect(request.assetId).toBe("asset-upload-001");
    expect(request.contentToken).toBe("token-123");
  });

  it("normalizes generated output lineage inputs", () => {
    const request = validateRegisterGeneratedOutputRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:output:1",
      assetId: "asset-output-001",
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
      source: {
        producerType: "run",
        runId: " run-001 ",
        systemId: " system-asset-render ",
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
    expect(request.visibility).toBe("workspace");
    expect(request.source).toEqual({
      producerType: "run",
      runId: "run-001",
      systemId: "system-asset-render",
    });
  });

  it("validates begin upload request filename and defaults", () => {
    const request = validateBeginAssetUploadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:begin-upload:1",
      assetId: "asset-upload-001",
      storageInstanceId: "workspace-storage-a",
      fileName: "image.png",
      mimeType: "IMAGE/PNG",
      sizeBytes: 123,
    });

    expect(request.mimeType).toBe("image/png");
    expect(request.area).toBe("input");
    expect(request.expiresInSeconds).toBeUndefined();

    expect(() => validateBeginAssetUploadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:begin-upload:2",
      assetId: "asset-upload-001",
      storageInstanceId: "workspace-storage-a",
      fileName: "../image.png",
      mimeType: "image/png",
      sizeBytes: 123,
    })).toThrow("fileName");

    expect(() => validateBeginAssetUploadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:begin-upload:3",
      assetId: "asset-upload-001",
      storageInstanceId: "workspace-storage-a",
      fileName: "image.png",
      mimeType: "not-a-mime-type",
      sizeBytes: 123,
    })).toThrow("mimeType");

    expect(() => validateBeginAssetUploadRequest({
      actorUserId: "user-owner",
      workspaceId: "workspace-a",
      operationKey: "op:asset:begin-upload:4",
      assetId: "asset-upload-001",
      storageInstanceId: "workspace-storage-a",
      fileName: "image.png",
      mimeType: "image/png",
      sizeBytes: (10 * 1024 * 1024 * 1024) + 1,
    })).toThrow("sizeBytes");
  });

  it("normalizes get-by-id query contracts", () => {
    const query = validateGetAssetByIdQuery({
      actorUserId: " user-owner ",
      workspaceId: " workspace-a ",
      assetId: " asset-upload-001 ",
      includeDeleted: true,
    });

    expect(query.actorUserId).toBe("user-owner");
    expect(query.workspaceId).toBe("workspace-a");
    expect(query.assetId).toBe("asset-upload-001");
    expect(query.includeDeleted).toBeTrue();
  });

  it("normalizes preview resolution query contracts", () => {
    const query = validateResolveAssetPreviewQuery({
      actorUserId: " user-owner ",
      workspaceId: " workspace-a ",
      assetId: " asset-upload-001 ",
      preferredMimeTypes: [" IMAGE/WEBP ", "image/png"],
    });

    expect(query.actorUserId).toBe("user-owner");
    expect(query.workspaceId).toBe("workspace-a");
    expect(query.assetId).toBe("asset-upload-001");
    expect(query.preferredMimeTypes).toEqual(["image/webp", "image/png"]);
  });
});
