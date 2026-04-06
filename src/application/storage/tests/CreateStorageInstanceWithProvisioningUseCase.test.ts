import { afterEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
} from "../../../domain/storage/StorageDomain";
import { SqliteStorageInstancePersistenceAdapter } from "../../../infrastructure/persistence/storage/SqliteStorageInstancePersistenceAdapter";
import { ServerManagedLocalStorageBackendAdapter } from "../../../infrastructure/storage/local/ServerManagedLocalStorageBackendAdapter";
import { ServerManagedSharedStorageBackendAdapter } from "../../../infrastructure/storage/shared/ServerManagedSharedStorageBackendAdapter";
import {
  StorageBackendAdapterRegistry,
  StorageBackendProvisioningOrchestrator,
} from "../../../infrastructure/storage";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
} from "../ports/StoragePolicyEvaluationPort";
import { StorageManagementErrorCodes } from "../use-cases/StorageManagementServiceContracts";
import { CreateStorageInstanceWithProvisioningUseCase } from "../use-cases/CreateStorageInstanceWithProvisioningUseCase";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

class AllowAllStoragePolicyEvaluationPort implements IStoragePolicyEvaluationPort {
  async evaluateStorageAction(input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0]) {
    return {
      allowed: true,
      reasonCode: `allowed:${input.action}`,
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    } as const;
  }

  async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

describe("CreateStorageInstanceWithProvisioningUseCase", () => {
  it("creates managed storage end-to-end for supported local and shared backend adapters", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-provisioning-e2e-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "storage.sqlite");
    const localRoot = path.join(root, "local-managed-storage");
    const sharedTargetRoot = path.join(root, "shared-target");
    mkdirSync(sharedTargetRoot, { recursive: true });

    const repository = new SqliteStorageInstancePersistenceAdapter(databasePath);
    const localAdapter = new ServerManagedLocalStorageBackendAdapter({
      managedStorageRootPath: localRoot,
    });
    const sharedAdapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "team-share",
          absolutePath: sharedTargetRoot,
          sharedPathStrategy: "none",
        },
      ],
    });

    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([
        {
          backendType: StorageBackendTypes.managedFilesystem,
          provisioningPort: localAdapter,
          capabilityInspectionPort: localAdapter,
        },
        {
          backendType: StorageBackendTypes.networkShare,
          provisioningPort: sharedAdapter,
          capabilityInspectionPort: sharedAdapter,
        },
      ]),
    );

    const useCase = new CreateStorageInstanceWithProvisioningUseCase({
      repository,
      policyPort: new AllowAllStoragePolicyEvaluationPort(),
      provisioningPort: orchestrator,
      capabilityPort: orchestrator,
    });

    const localCreated = await useCase.execute({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:managed-local",
      correlationId: "corr-storage-create-managed-local",
      storageInstanceId: "storage-managed-local",
      displayName: "Managed Local Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownerUserIdentityId: "user-admin",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-managed-local",
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      requestBackendProvisioning: true,
      includeCapabilities: true,
      createdAt: "2026-04-06T12:00:00.000Z",
    });

    expect(localCreated.ok).toBeTrue();
    if (!localCreated.ok) {
      return;
    }
    expect(localCreated.value.provisioning?.accepted).toBeTrue();
    expect(localCreated.value.storageInstance.lifecycleState).toBe(StorageLifecycleStates.active);
    expect(localCreated.value.capabilities?.backendType).toBe(StorageBackendTypes.managedFilesystem);

    const sharedCreated = await useCase.execute({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:shared",
      correlationId: "corr-storage-create-shared",
      storageInstanceId: "storage-shared",
      displayName: "Managed Shared Storage",
      backendType: StorageBackendTypes.networkShare,
      ownerUserIdentityId: "user-admin",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-shared",
        labels: {
          sharedTargetId: "team-share",
        },
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      requestBackendProvisioning: true,
      includeCapabilities: true,
      createdAt: "2026-04-06T12:05:00.000Z",
    });

    expect(sharedCreated.ok).toBeTrue();
    if (!sharedCreated.ok) {
      return;
    }
    expect(sharedCreated.value.provisioning?.accepted).toBeTrue();
    expect(sharedCreated.value.storageInstance.lifecycleState).toBe(StorageLifecycleStates.active);
    expect(sharedCreated.value.capabilities?.backendType).toBe(StorageBackendTypes.networkShare);

    const persistedLocal = await repository.findStorageInstanceById("storage-managed-local");
    const persistedShared = await repository.findStorageInstanceById("storage-shared");
    expect(persistedLocal?.lifecycleState).toBe(StorageLifecycleStates.active);
    expect(persistedShared?.lifecycleState).toBe(StorageLifecycleStates.active);

    repository.dispose();
  });

  it("persists an explicit failed lifecycle state when backend provisioning is rejected", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-provisioning-failed-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "storage.sqlite");
    const sharedTargetRoot = path.join(root, "shared-target");
    mkdirSync(sharedTargetRoot, { recursive: true });

    const repository = new SqliteStorageInstancePersistenceAdapter(databasePath);
    const sharedAdapter = new ServerManagedSharedStorageBackendAdapter({
      targetLabelKey: "sharedTargetId",
      targets: [
        {
          targetId: "team-share",
          absolutePath: sharedTargetRoot,
          sharedPathStrategy: "none",
        },
      ],
    });

    const orchestrator = new StorageBackendProvisioningOrchestrator(
      new StorageBackendAdapterRegistry([
        {
          backendType: StorageBackendTypes.networkShare,
          provisioningPort: sharedAdapter,
          capabilityInspectionPort: sharedAdapter,
        },
      ]),
    );

    const useCase = new CreateStorageInstanceWithProvisioningUseCase({
      repository,
      policyPort: new AllowAllStoragePolicyEvaluationPort(),
      provisioningPort: orchestrator,
      capabilityPort: orchestrator,
    });

    const failed = await useCase.execute({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:shared-failed",
      correlationId: "corr-storage-create-shared-failed",
      storageInstanceId: "storage-shared-failed",
      displayName: "Managed Shared Storage Failed",
      backendType: StorageBackendTypes.networkShare,
      ownerUserIdentityId: "user-admin",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-shared-failed",
        // No sharedTargetId label is provided and no workspace default mapping is configured.
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      requestBackendProvisioning: true,
      includeCapabilities: true,
      createdAt: "2026-04-06T12:10:00.000Z",
    });

    expect(failed).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.provisioningFailed,
      }),
    });

    const persistedFailed = await repository.findStorageInstanceById("storage-shared-failed");
    expect(persistedFailed).toBeDefined();
    expect(persistedFailed?.lifecycleState).toBe(StorageLifecycleStates.failed);

    repository.dispose();
  });

  it("maps policy denial to access-denied without persisting records", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-storage-provisioning-access-denied-"));
    createdRoots.push(root);
    const repository = new SqliteStorageInstancePersistenceAdapter(path.join(root, "storage.sqlite"));

    const denyCreatePolicyPort: IStoragePolicyEvaluationPort = {
      async evaluateStorageAction(input) {
        if (input.action === StoragePolicyActions.create) {
          return {
            allowed: false,
            reasonCode: "storage-create-denied",
            message: "Create denied by policy.",
            occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
          } as const;
        }
        return {
          allowed: true,
          reasonCode: "allowed",
          occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
        } as const;
      },
      async resolveAccessibleStorageInstanceIds(input) {
        return input.candidateStorageInstanceIds;
      },
    };

    const useCase = new CreateStorageInstanceWithProvisioningUseCase({
      repository,
      policyPort: denyCreatePolicyPort,
    });

    const denied = await useCase.execute({
      actorUserIdentityId: "user-admin",
      workspaceId: "workspace-alpha",
      operationKey: "storage:create:policy-denied",
      correlationId: "corr-storage-create-policy-denied",
      storageInstanceId: "storage-policy-denied",
      displayName: "Policy Denied Storage",
      backendType: StorageBackendTypes.managedFilesystem,
      ownerUserIdentityId: "user-admin",
      access: {
        mode: StorageAccessModes.readWrite,
        scope: StorageAccessScopes.workspaceMembers,
      },
      policy: {
        policyId: "policy-denied",
        encryption: {
          profileId: "profile-default",
          envelopeRequired: true,
        },
      },
      requestBackendProvisioning: true,
      createdAt: "2026-04-06T12:00:00.000Z",
    });

    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageManagementErrorCodes.accessDenied,
      }),
    });
    expect(await repository.findStorageInstanceById("storage-policy-denied")).toBeUndefined();

    repository.dispose();
  });
});
