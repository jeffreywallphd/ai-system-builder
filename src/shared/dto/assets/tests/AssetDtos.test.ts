import { describe, expect, it } from "bun:test";
import { AssetKinds, AssetStorageAreas, AssetVisibilities, createAsset, createAssetLocationRef, createAssetOwnershipMetadata, createAssetVersion, createContentDescriptor, createStorageInstanceRef } from "@domain/assets/AssetDomain";
import { rehydrateAssetFromDto, toAssetDto } from "../AssetDtos";

describe("AssetDtos", () => {
  it("round-trips logical assets without filesystem path coupling", () => {
    const storage = createStorageInstanceRef("storage-instance://workspace-assets");
    const asset = createAsset({
      id: "asset-dto-001",
      kind: AssetKinds.generatedOutput,
      ownership: createAssetOwnershipMetadata({
        workspaceId: "workspace-a",
        ownerUserId: "user-owner",
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:00:00.000Z",
      }),
      visibility: AssetVisibilities.shared,
      sharingPolicyRef: {
        policyId: "sharing-policy:asset-001",
        policyVersion: "1",
      },
      storageBinding: storage,
      initialVersion: createAssetVersion({
        versionId: "asset-version:1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: storage,
          objectKey: "workspace-a/output/asset-dto-001/v1",
          area: AssetStorageAreas.output,
        }),
        content: createContentDescriptor({
          mimeType: "application/json",
          sizeBytes: 100,
          checksum: {
            algorithm: "sha256",
            digest: "c".repeat(64),
          },
        }),
        createdBy: "user-owner",
      }),
    });

    const dto = toAssetDto(asset);
    const rehydrated = rehydrateAssetFromDto(dto);

    expect(rehydrated.id).toBe(asset.id);
    expect(rehydrated.storageBinding.uri).toBe("storage-instance://workspace-assets");
    expect(rehydrated.versions[0]?.location.objectKey).toBe("workspace-a/output/asset-dto-001/v1");
    expect((dto as unknown as { path?: string }).path).toBeUndefined();
  });
});

