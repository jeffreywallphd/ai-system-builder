import { describe, expect, it } from "bun:test";
import {
  AssetKinds,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
} from "../../../../domain/assets/AssetDomain";
import {
  AssetLineageRelations,
  mapAssetRecordToRowValues,
  mapAssetRowsToDomain,
  mapAssetVersionToRowValues,
  normalizeAssetLookup,
  normalizeLineageRelation,
  type AssetRecordRow,
  type AssetVersionRow,
} from "../AssetPersistenceMapper";

describe("AssetPersistenceMapper", () => {
  it("maps persisted rows to canonical asset domain model", () => {
    const assetRow: AssetRecordRow = {
      asset_id: "asset-alpha",
      workspace_id: "workspace-alpha",
      owner_user_id: "user-owner",
      storage_instance_id: "storage-alpha",
      storage_uri: "storage-instance://storage-alpha",
      kind: AssetKinds.uploadedFile,
      visibility: AssetVisibilities.private,
      sharing_policy_id: null,
      sharing_policy_version: null,
      lifecycle_state: "active",
      archived_at: null,
      archived_by: null,
      deleted_at: null,
      deleted_by: null,
      display_name: "input.png",
      current_version_id: "ver-1",
      created_by: "user-owner",
      created_at: "2026-04-06T12:00:00.000Z",
      last_modified_by: "user-owner",
      last_modified_at: "2026-04-06T12:00:00.000Z",
    };

    const versionRows: AssetVersionRow[] = [
      {
        asset_id: "asset-alpha",
        version_id: "ver-1",
        revision: 1,
        storage_instance_id: "storage-alpha",
        storage_uri: "storage-instance://storage-alpha",
        object_key: "workspace-alpha/input/input.png",
        object_version_id: null,
        storage_area: "input",
        mime_type: "image/png",
        size_bytes: 1024,
        checksum_algorithm: "sha256",
        checksum_digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        original_file_name: "input.png",
        content_encryption_descriptor: null,
        created_by: "user-owner",
        created_at: "2026-04-06T12:00:00.000Z",
      },
    ];

    const mapped = mapAssetRowsToDomain(assetRow, versionRows);
    expect(mapped.id).toBe("asset-alpha");
    expect(mapped.storageBinding.storageInstanceId).toBe("storage-alpha");
    expect(mapped.versions).toHaveLength(1);
    expect(mapped.versions[0]?.location.objectKey).toBe("workspace-alpha/input/input.png");
  });

  it("maps domain assets to row values for asset and version tables", () => {
    const asset = createAsset({
      id: "asset-beta",
      kind: AssetKinds.generatedOutput,
      ownership: createAssetOwnershipMetadata({
        workspaceId: "workspace-beta",
        ownerUserId: "user-owner",
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:05:00.000Z",
      }),
      visibility: AssetVisibilities.private,
      storageBinding: createStorageInstanceRef({
        storageInstanceId: "storage-beta",
      }),
      initialVersion: createAssetVersion({
        versionId: "ver-1",
        revision: 1,
        location: createAssetLocationRef({
          storageInstance: {
            storageInstanceId: "storage-beta",
          },
          objectKey: "workspace-beta/output/output-1.png",
          area: "output",
        }),
        content: createContentDescriptor({
          mimeType: "image/png",
          sizeBytes: 2048,
          checksum: {
            algorithm: "sha256",
            digest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          },
          originalFileName: "output-1.png",
        }),
        createdBy: "user-owner",
        createdAt: "2026-04-06T12:05:00.000Z",
      }),
    });

    const assetValues = mapAssetRecordToRowValues(asset);
    const versionValues = mapAssetVersionToRowValues(asset);

    expect(assetValues[0]).toBe("asset-beta");
    expect(assetValues[5]).toBe(AssetKinds.generatedOutput);
    expect(versionValues).toHaveLength(1);
    expect(versionValues[0]?.[1]).toBe("ver-1");
    expect(versionValues[0]?.[5]).toBe("workspace-beta/output/output-1.png");

    expect(normalizeAssetLookup("  asset-beta ")).toBe("asset-beta");
    expect(normalizeAssetLookup("   ")).toBeUndefined();
    expect(normalizeLineageRelation(undefined)).toBe(AssetLineageRelations.derivedFrom);
  });

  it("rehydrates encrypted content descriptors from persisted version rows", () => {
    const assetRow: AssetRecordRow = {
      asset_id: "asset-encrypted",
      workspace_id: "workspace-alpha",
      owner_user_id: "user-owner",
      storage_instance_id: "storage-alpha",
      storage_uri: "storage-instance://storage-alpha",
      kind: AssetKinds.uploadedFile,
      visibility: AssetVisibilities.private,
      sharing_policy_id: null,
      sharing_policy_version: null,
      lifecycle_state: "active",
      archived_at: null,
      archived_by: null,
      deleted_at: null,
      deleted_by: null,
      display_name: "input.png",
      current_version_id: "ver-1",
      created_by: "user-owner",
      created_at: "2026-04-06T12:00:00.000Z",
      last_modified_by: "user-owner",
      last_modified_at: "2026-04-06T12:00:00.000Z",
    };

    const versionRows: AssetVersionRow[] = [
      {
        asset_id: "asset-encrypted",
        version_id: "ver-1",
        revision: 1,
        storage_instance_id: "storage-alpha",
        storage_uri: "storage-instance://storage-alpha",
        object_key: "workspace-alpha/input/input.png",
        object_version_id: null,
        storage_area: "input",
        mime_type: "image/png",
        size_bytes: 1024,
        checksum_algorithm: "sha256",
        checksum_digest: "a".repeat(64),
        original_file_name: "input.png",
        content_encryption_descriptor: JSON.stringify({
          format: "asset-content/aes-256-gcm/v1",
          algorithm: "aes-256-gcm",
          keyReferenceId: "kek:asset-content:workspace:workspace-alpha:v1",
          keyId: "kek:asset-content:workspace:workspace-alpha",
          keyVersion: "v1",
          keyScope: "workspace",
          workspaceId: "workspace-alpha",
          ivBase64: Buffer.from("123456789012", "utf8").toString("base64"),
          authTagBase64: Buffer.alloc(16, 1).toString("base64"),
          aad: "asset-content-encryption/v1;workspace=workspace-alpha",
          encryptedAt: "2026-04-06T12:00:00.000Z",
        }),
        created_by: "user-owner",
        created_at: "2026-04-06T12:00:00.000Z",
      },
    ];

    const mapped = mapAssetRowsToDomain(assetRow, versionRows);
    expect(mapped.versions[0]?.content.encryption?.format).toBe("asset-content/aes-256-gcm/v1");
    expect(mapped.versions[0]?.content.encryption?.keyReferenceId).toBe("kek:asset-content:workspace:workspace-alpha:v1");
  });
});
