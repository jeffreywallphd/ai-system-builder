import { describe, expect, it } from "bun:test";
import {
  AssetKinds,
  AssetStorageAreas,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
} from "../../../../domain/assets/AssetDomain";
import {
  AssetTransportContractError,
  AssetTransportContractVersions,
  toAssetAuditEventPayloadDto,
  toAssetDetailDto,
  toAssetDownloadAuthorizationDto,
} from "../AssetTransportContracts";

describe("AssetTransportContracts", () => {
  function buildAsset() {
    const storage = createStorageInstanceRef("storage-instance://workspace-assets");
    return createAsset({
      id: "asset-contract-001",
      kind: AssetKinds.generatedOutput,
      ownership: createAssetOwnershipMetadata({
        workspaceId: "workspace-a",
        ownerUserId: "user-owner",
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:00:00.000Z",
      }),
      visibility: AssetVisibilities.shared,
      sharingPolicyRef: {
        policyId: "sharing-policy-1",
      },
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-contract-001:v1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-a/output/asset-contract-001/v1",
          area: AssetStorageAreas.output,
        }),
        content: createContentDescriptor({
          mimeType: "application/json",
          sizeBytes: 10,
          checksum: {
            algorithm: "sha256",
            digest: "f".repeat(64),
          },
        }),
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:00:00.000Z",
      }),
    });
  }

  it("projects logical asset detail payloads with contract version markers", () => {
    const dto = toAssetDetailDto(buildAsset(), {
      isOwnedByActor: true,
      uploadState: "ready",
      previewAvailable: true,
      previewMimeTypeHint: "application/json",
      allowedActions: {
        canInitiateUpload: true,
        canAuthorizeDownload: true,
        canResolvePreview: true,
        canArchive: true,
        canDelete: true,
      },
      links: {
        self: "/api/v1/assets/asset-contract-001?workspaceId=workspace-a",
        list: "/api/v1/assets?workspaceId=workspace-a",
        initiateUpload: "/api/v1/assets/asset-contract-001/uploads/initiate?workspaceId=workspace-a",
        authorizeDownload: "/api/v1/assets/asset-contract-001/downloads/authorize?workspaceId=workspace-a",
        resolvePreview: "/api/v1/assets/asset-contract-001/preview?workspaceId=workspace-a",
        listGeneratedOutputsBySource: "/api/v1/assets?workspaceId=workspace-a&sourceAssetId=asset-contract-001",
      },
      lineage: {
        sources: [{
          sourceAssetId: "asset-source-001",
          sourceAssetVersionId: "asset-source-001:v1",
          relation: "derived-from",
        }],
      },
    });

    expect(dto.contractVersion).toBe(AssetTransportContractVersions.v1);
    expect(dto.assetId).toBe("asset-contract-001");
    expect(dto.currentVersion.versionId).toBe("asset-contract-001:v1");
    expect(dto.uploadState).toBe("ready");
    expect(dto.allowedActions?.canInitiateUpload).toBeTrue();
    expect(dto.lineage?.sources[0]?.sourceAssetId).toBe("asset-source-001");
    expect((dto as unknown as { path?: string }).path).toBeUndefined();
  });

  it("rejects filesystem-like object keys when projecting download authorization", () => {
    expect(() => toAssetDownloadAuthorizationDto({
      assetId: "asset-contract-001",
      versionId: "asset-contract-001:v1",
      workspaceId: "workspace-a",
      storageInstanceId: "workspace-assets",
      objectKey: "C:/temp/asset-contract-001.png",
      mimeType: "image/png",
      sizeBytes: 1,
      contentToken: "token-1",
      expiresAt: "2026-04-06T13:00:00.000Z",
    })).toThrow(AssetTransportContractError);
  });

  it("projects audit events as stable event payload DTOs", () => {
    const dto = toAssetAuditEventPayloadDto({
      type: "asset-looked-up",
      occurredAt: "2026-04-06T12:30:00.000Z",
      workspaceId: "workspace-a",
      actorUserId: "user-owner",
      asset: {
        assetId: "asset-contract-001",
        kind: "generated-output",
        visibility: "shared",
        lifecycleState: "active",
        versionId: "asset-contract-001:v1",
      },
    });

    expect(dto.contractVersion).toBe(AssetTransportContractVersions.v1);
    expect(dto.type).toBe("asset-looked-up");
    expect(dto.asset.assetId).toBe("asset-contract-001");
  });
});

