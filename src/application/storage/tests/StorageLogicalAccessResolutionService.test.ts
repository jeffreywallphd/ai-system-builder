import { describe, expect, it } from "bun:test";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import type {
  IStorageInstanceRepository,
  StorageInstanceListQuery,
  StorageInstanceMutationContext,
  StorageInstanceMutationResult,
} from "../ports/IStorageInstanceRepository";
import type { IStorageObjectAccessResolverPort } from "../ports/StorageObjectAccessResolverPort";
import type { IStorageObjectPort } from "../ports/StorageObjectPort";
import {
  StoragePolicyActions,
  type IStoragePolicyEvaluationPort,
  type StoragePolicyDecision,
} from "../ports/StoragePolicyEvaluationPort";
import { StorageLogicalAccessResolutionService } from "../use-cases/StorageLogicalAccessResolutionService";
import {
  StorageLogicalAccessOperationIntents,
  StorageLogicalAccessResolutionErrorCodes,
} from "../use-cases/StorageLogicalAccessResolutionServiceContracts";

class InMemoryStorageRepository implements IStorageInstanceRepository {
  private readonly records = new Map<string, StorageInstance>();

  public seed(storage: StorageInstance): void {
    this.records.set(storage.id, storage);
  }

  public async findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined> {
    return this.records.get(storageInstanceId);
  }

  public async listStorageInstances(_query: StorageInstanceListQuery): Promise<ReadonlyArray<StorageInstance>> {
    return [...this.records.values()];
  }

  public async createStorageInstance(
    storageInstance: StorageInstance,
    _mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }> {
    this.records.set(storageInstance.id, storageInstance);
    return {
      changed: true,
      wasReplay: false,
      storageInstance,
    };
  }

  public async saveStorageInstance(
    storageInstance: StorageInstance,
    _mutation: StorageInstanceMutationContext,
  ): Promise<StorageInstanceMutationResult & { readonly storageInstance: StorageInstance }> {
    this.records.set(storageInstance.id, storageInstance);
    return {
      changed: true,
      wasReplay: false,
      storageInstance,
    };
  }
}

class PolicyPort implements IStoragePolicyEvaluationPort {
  public deny = false;
  public readonly evaluatedActions: string[] = [];

  public async evaluateStorageAction(
    input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0],
  ): Promise<StoragePolicyDecision> {
    this.evaluatedActions.push(input.action);
    return {
      allowed: !this.deny,
      reasonCode: this.deny ? "denied-by-test" : "allowed-by-test",
      message: this.deny ? "Denied by test policy." : undefined,
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    };
  }

  public async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

class ObjectResolver implements IStorageObjectAccessResolverPort {
  public readonly localObjectPort: IStorageObjectPort = {
    createObjectKey() {
      return {
        objectKey: "assets/input/aa/bb/file.bin",
        normalizedFileName: "file.bin",
        partition: ["aa", "bb"],
      };
    },
    async writeObject() {
      return {
        objectKey: "assets/input/aa/bb/file.bin",
        sizeBytes: 3,
        checksum: {
          algorithm: "sha256",
          digest: "abc",
        },
        writtenAt: "2026-04-06T12:00:00.000Z",
      };
    },
    async objectExists() {
      return true;
    },
    async readObjectMetadata() {
      return {
        objectKey: "assets/input/aa/bb/file.bin",
        sizeBytes: 3,
        lastModifiedAt: "2026-04-06T12:00:00.000Z",
      };
    },
    async openObjectReadStream() {
      return (async function* stream() {
        yield new Uint8Array([1, 2, 3]);
      })();
    },
    async deleteObject() {
      return {
        objectKey: "assets/input/aa/bb/file.bin",
        deleted: true,
        deletedAt: "2026-04-06T12:00:00.000Z",
      };
    },
  };

  public includeObjectPort = true;

  public resolveStorageObjectPort(_backendType: StorageInstance["backendType"]): IStorageObjectPort | undefined {
    return this.includeObjectPort ? this.localObjectPort : undefined;
  }
}

function buildStorageInstance(overrides?: Partial<StorageInstance>): StorageInstance {
  return createStorageInstance({
    id: overrides?.id ?? "storage-assets",
    displayName: overrides?.displayName ?? "Storage Assets",
    backendType: overrides?.backendType ?? StorageBackendTypes.managedFilesystem,
    ownership: overrides?.ownership ?? {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: overrides?.access ?? {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    lifecycleState: overrides?.lifecycleState ?? StorageLifecycleStates.active,
    policy: overrides?.policy ?? {
      policyId: "policy-assets",
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: overrides?.createdBy ?? "user-owner",
    createdAt: overrides?.createdAt ?? "2026-04-06T12:00:00.000Z",
    lastCorrelationId: overrides?.lastCorrelationId ?? "corr-storage-logical-access",
  });
}

describe("StorageLogicalAccessResolutionService", () => {
  it("resolves logical storage instance references to authorized object access plans", async () => {
    const repository = new InMemoryStorageRepository();
    repository.seed(buildStorageInstance({ id: "storage-a" }));
    const policyPort = new PolicyPort();
    const objectResolver = new ObjectResolver();

    const service = new StorageLogicalAccessResolutionService({
      repository,
      policyPort,
      objectAccessResolver: objectResolver,
    });

    const resolved = await service.resolveLogicalAccessPlan({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceRef: "storage-instance://storage-a",
      intent: StorageLogicalAccessOperationIntents.readObjectMetadata,
      occurredAt: "2026-04-06T12:10:00.000Z",
    });

    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) {
      return;
    }

    expect(resolved.value.storageInstance.id).toBe("storage-a");
    expect(resolved.value.objectPort).toBe(objectResolver.localObjectPort);
    expect(resolved.value.intent).toBe(StorageLogicalAccessOperationIntents.readObjectMetadata);
    expect(policyPort.evaluatedActions).toEqual([StoragePolicyActions.view]);
  });

  it("maps mutating intents to use-for-assets policy checks", async () => {
    const repository = new InMemoryStorageRepository();
    repository.seed(buildStorageInstance({ id: "storage-b" }));
    const policyPort = new PolicyPort();

    const service = new StorageLogicalAccessResolutionService({
      repository,
      policyPort,
      objectAccessResolver: new ObjectResolver(),
    });

    const resolved = await service.resolveLogicalAccessPlan({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-b",
      intent: StorageLogicalAccessOperationIntents.writeObject,
    });

    expect(resolved.ok).toBeTrue();
    expect(policyPort.evaluatedActions).toEqual([StoragePolicyActions.useForAssets]);
  });

  it("rejects invalid logical storage references", async () => {
    const service = new StorageLogicalAccessResolutionService({
      repository: new InMemoryStorageRepository(),
      policyPort: new PolicyPort(),
      objectAccessResolver: new ObjectResolver(),
    });

    const resolved = await service.resolveLogicalAccessPlan({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceRef: "storage-instance://storage-a/input",
      intent: StorageLogicalAccessOperationIntents.objectExists,
    });

    expect(resolved).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageLogicalAccessResolutionErrorCodes.invalidRequest,
      }),
    });
  });

  it("rejects cross-workspace and missing storage resolution attempts", async () => {
    const repository = new InMemoryStorageRepository();
    repository.seed(buildStorageInstance({
      id: "storage-c",
      ownership: {
        workspaceId: "workspace-beta",
        ownerUserIdentityId: "user-owner",
      },
    }));

    const service = new StorageLogicalAccessResolutionService({
      repository,
      policyPort: new PolicyPort(),
      objectAccessResolver: new ObjectResolver(),
    });

    const resolved = await service.resolveLogicalAccessPlan({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-c",
      intent: StorageLogicalAccessOperationIntents.objectExists,
    });

    expect(resolved).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageLogicalAccessResolutionErrorCodes.notFound,
      }),
    });
  });

  it("rejects unauthorized policy decisions and unsupported backend object adapters", async () => {
    const repository = new InMemoryStorageRepository();
    repository.seed(buildStorageInstance({ id: "storage-d" }));
    const policyPort = new PolicyPort();
    policyPort.deny = true;
    const objectResolver = new ObjectResolver();

    const service = new StorageLogicalAccessResolutionService({
      repository,
      policyPort,
      objectAccessResolver: objectResolver,
    });

    const denied = await service.resolveLogicalAccessPlan({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-d",
      intent: StorageLogicalAccessOperationIntents.writeObject,
    });
    expect(denied).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageLogicalAccessResolutionErrorCodes.policyViolation,
      }),
    });

    policyPort.deny = false;
    objectResolver.includeObjectPort = false;

    const unsupported = await service.resolveLogicalAccessPlan({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-d",
      intent: StorageLogicalAccessOperationIntents.writeObject,
    });
    expect(unsupported).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: StorageLogicalAccessResolutionErrorCodes.capabilityUnsupported,
      }),
    });
  });
});

