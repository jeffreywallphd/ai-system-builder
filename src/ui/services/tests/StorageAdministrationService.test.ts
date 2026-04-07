import { describe, expect, it, mock } from "bun:test";
import { StorageAdministrationService } from "../StorageAdministrationService";
import type { StorageAdministrationClient } from "@shared/storage/StorageAdministrationClient";

describe("StorageAdministrationService", () => {
  it("delegates activate and deactivate lifecycle actions to the storage administration client", async () => {
    const client: StorageAdministrationClient = {
      listStorageInstances: mock(async () => ({ ok: true, data: {} as any })),
      createStorageInstance: mock(async () => ({ ok: true, data: {} as any })),
      updateStorageMetadata: mock(async () => ({ ok: true, data: {} as any })),
      activateStorageInstance: mock(async () => ({ ok: true, data: {} as any })),
      deactivateStorageInstance: mock(async () => ({ ok: true, data: {} as any })),
      getStorageInstanceDetail: mock(async () => ({ ok: true, data: {} as any })),
      getStorageInstanceHealth: mock(async () => ({ ok: true, data: {} as any })),
    };

    const service = new StorageAdministrationService(client);
    await service.activateStorageInstance({
      workspaceId: "workspace-1",
      storageInstanceId: "storage-1",
      includeCapabilities: true,
    }, "token-1");
    await service.deactivateStorageInstance({
      workspaceId: "workspace-1",
      storageInstanceId: "storage-1",
      targetLifecycleState: "suspended",
    }, "token-2");

    expect(client.activateStorageInstance).toHaveBeenCalledTimes(1);
    expect(client.deactivateStorageInstance).toHaveBeenCalledTimes(1);
    expect(client.activateStorageInstance).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      storageInstanceId: "storage-1",
      includeCapabilities: true,
    }, "token-1");
    expect(client.deactivateStorageInstance).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      storageInstanceId: "storage-1",
      targetLifecycleState: "suspended",
    }, "token-2");
  });
});

