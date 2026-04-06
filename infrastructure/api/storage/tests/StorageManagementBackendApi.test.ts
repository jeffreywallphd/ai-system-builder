import { describe, expect, it } from "bun:test";
import type {
  IStorageManagementService,
  StorageManagementResult,
} from "../../../../src/application/storage/use-cases/StorageManagementServiceContracts";
import { StorageManagementErrorCodes } from "../../../../src/application/storage/use-cases/StorageManagementServiceContracts";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  StorageManagedActions,
  createStorageInstance,
  type StorageInstance,
} from "../../../../src/domain/storage/StorageDomain";
import { StorageManagementBackendApi } from "../StorageManagementBackendApi";

class StubStorageManagementService implements IStorageManagementService {
  private readonly storageInstance: StorageInstance = createStorageInstance({
    id: "storage-alpha",
    displayName: "Storage Alpha",
    backendType: StorageBackendTypes.managedFilesystem,
    lifecycleState: StorageLifecycleStates.active,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: "policy-alpha",
      labels: {
        purpose: "tests",
      },
      encryption: {
        profileId: "enc-profile-alpha",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastModifiedBy: "user-owner",
    lastModifiedAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-alpha",
  });

  public async createStorageInstance(): Promise<StorageManagementResult<{
    readonly storageInstance: StorageInstance;
    readonly accessSummary: {
      readonly actorUserIdentityId: string;
      readonly workspaceId: string;
      readonly ownerUserIdentityId: string;
      readonly mode: StorageInstance["access"]["mode"];
      readonly scope: StorageInstance["access"]["scope"];
      readonly isOwner: boolean;
      readonly source: "authorization-policy";
      readonly effectivePermissions: ReadonlyArray<{
        readonly action: StorageInstance["access"]["mode"] extends never ? never : typeof StorageManagedActions[keyof typeof StorageManagedActions];
        readonly effect: "allowed";
      }>;
      readonly allowedActions: ReadonlyArray<typeof StorageManagedActions[keyof typeof StorageManagedActions]>;
      readonly policyRestrictedCapabilities: ReadonlyArray<{
        readonly capability: "mutable-writes" | "cross-workspace-reads" | "preview-decryption" | "worker-decryption";
        readonly restricted: boolean;
      }>;
    };
  }>> {
    return {
      ok: true,
      value: {
        storageInstance: this.storageInstance,
        accessSummary: this.accessSummary("user-owner"),
      },
    };
  }

  public async updateStorageMetadata(): Promise<StorageManagementResult<{
    readonly storageInstance: StorageInstance;
    readonly accessSummary: ReturnType<StubStorageManagementService["accessSummary"]>;
  }>> {
    return {
      ok: true,
      value: {
        storageInstance: this.storageInstance,
        accessSummary: this.accessSummary("user-owner"),
      },
    };
  }

  public async activateStorageInstance(): Promise<StorageManagementResult<{
    readonly storageInstance: StorageInstance;
    readonly accessSummary: ReturnType<StubStorageManagementService["accessSummary"]>;
  }>> {
    return {
      ok: false,
      error: {
        code: StorageManagementErrorCodes.policyViolation,
        message: "Storage lifecycle action is forbidden.",
      },
    };
  }

  public async deactivateStorageInstance(): Promise<StorageManagementResult<{
    readonly storageInstance: StorageInstance;
    readonly accessSummary: ReturnType<StubStorageManagementService["accessSummary"]>;
  }>> {
    return {
      ok: true,
      value: {
        storageInstance: {
          ...this.storageInstance,
          lifecycleState: StorageLifecycleStates.suspended,
          lastModifiedAt: "2026-04-06T12:30:00.000Z",
          lastCorrelationId: "corr-storage-suspend",
        },
        accessSummary: this.accessSummary("user-owner"),
      },
    };
  }

  public async listAccessibleStorageInstances(): Promise<StorageManagementResult<{
    readonly items: ReadonlyArray<{
      readonly storageInstance: StorageInstance;
      readonly accessSummary: ReturnType<StubStorageManagementService["accessSummary"]>;
    }>;
  }>> {
    return {
      ok: true,
      value: {
        items: [{
          storageInstance: this.storageInstance,
          accessSummary: this.accessSummary("user-owner"),
        }],
      },
    };
  }

  public async getStorageInstanceDetails(): Promise<StorageManagementResult<{
    readonly storageInstance: StorageInstance;
    readonly accessSummary: ReturnType<StubStorageManagementService["accessSummary"]>;
  }>> {
    return {
      ok: true,
      value: {
        storageInstance: this.storageInstance,
        accessSummary: this.accessSummary("user-owner"),
      },
    };
  }

  private accessSummary(actorUserIdentityId: string) {
    return Object.freeze({
      actorUserIdentityId,
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
      isOwner: true,
      source: "authorization-policy" as const,
      effectivePermissions: Object.freeze(Object.values(StorageManagedActions).map((action) => Object.freeze({
        action,
        effect: "allowed" as const,
      }))),
      allowedActions: Object.freeze(Object.values(StorageManagedActions)),
      policyRestrictedCapabilities: Object.freeze([]),
    });
  }
}

describe("StorageManagementBackendApi", () => {
  it("maps create/list/detail flows into shared storage DTOs", async () => {
    const backendApi = new StorageManagementBackendApi({
      storageManagementService: new StubStorageManagementService(),
    });

    const created = await backendApi.createStorageInstance({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      backendType: StorageBackendTypes.managedFilesystem,
      display: {
        displayName: "Storage Alpha",
      },
      ownerUserIdentityId: "user-owner",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-alpha",
        labels: {
          purpose: "tests",
        },
        encryptionProfileId: "enc-profile-alpha",
        envelopeRequired: true,
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }
    expect(created.data.storage.storageInstanceId).toBe("storage-alpha");
    expect((created.data.storage as Record<string, unknown>).sensitive).toBeUndefined();
    expect(created.data.storage.sensitiveRedaction?.contractVersion).toBe("storage-transport/v1");

    const listed = await backendApi.listStorageInstances({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      includeCapabilities: true,
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok || !listed.data) {
      return;
    }
    expect(listed.data.items).toHaveLength(1);
    expect(listed.data.items[0]?.storageInstanceId).toBe("storage-alpha");

    const detail = await backendApi.getStorageInstanceDetail({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      includeCapabilities: true,
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok || !detail.data) {
      return;
    }
    expect(detail.data.storage.storageInstanceId).toBe("storage-alpha");
  });

  it("rejects unsupported metadata mutation payload fields", async () => {
    const backendApi = new StorageManagementBackendApi({
      storageManagementService: new StubStorageManagementService(),
    });

    const response = await backendApi.updateStorageMetadata({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
      display: {
        displayName: "Storage Alpha",
      },
      replication: {
        mode: "none",
      },
      includeCapabilities: true,
    });
    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });

  it("maps policy violations to forbidden API errors", async () => {
    const backendApi = new StorageManagementBackendApi({
      storageManagementService: new StubStorageManagementService(),
    });

    const response = await backendApi.activateStorageInstance({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
    });
    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("forbidden");
  });
});
