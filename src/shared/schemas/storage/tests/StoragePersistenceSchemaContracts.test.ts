import { describe, expect, it } from "bun:test";
import { parseStorageInstancePersistenceRecord } from "../StoragePersistenceSchemaContracts";

describe("StoragePersistenceSchemaContracts", () => {
  it("parses valid storage persistence records", () => {
    const parsed = parseStorageInstancePersistenceRecord({
      storageInstanceId: "storage-1",
      displayName: "Primary Storage",
      backendType: "object-storage",
      lifecycleState: "active",
      ownership: {
        workspaceId: "workspace-1",
        ownerUserIdentityId: "user-owner",
      },
      access: {
        mode: "read-write",
        scope: "workspace-members",
      },
      replication: {
        mode: "none",
      },
      policy: {
        policyId: "policy-1",
        immutableWrites: false,
        allowCrossWorkspaceReads: false,
        labels: {},
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
        security: {
          encryptionMode: "platform-managed",
          contentEncryptionRequired: true,
          keyScope: "workspace",
          allowPreviewDecryption: false,
          allowWorkerDecryption: false,
        },
        lifecycle: {
          retentionExpiryAction: "archive",
        },
      },
      tenancy: {
        scope: "workspace",
        workspaceId: "workspace-1",
      },
      lastCorrelationId: "corr-1",
      createdAt: "2026-04-06T10:00:00.000Z",
      createdBy: "user-owner",
      lastModifiedAt: "2026-04-06T10:00:00.000Z",
      lastModifiedBy: "user-owner",
      revision: 1,
      schemaVersion: 1,
    });

    expect(parsed.storageInstanceId).toBe("storage-1");
    expect(parsed.access.mode).toBe("read-write");
  });

  it("fails on invalid lifecycle payloads", () => {
    expect(() => parseStorageInstancePersistenceRecord({
      storageInstanceId: "storage-1",
    })).toThrow("StorageInstancePersistenceRecord payload is invalid");
  });
});
