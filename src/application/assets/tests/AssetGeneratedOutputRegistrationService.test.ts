import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "../ports/IAssetRepository";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IStorageInstanceRepository } from "../../storage/ports/IStorageInstanceRepository";
import type { IStoragePolicyEvaluationPort } from "../../storage/ports/StoragePolicyEvaluationPort";
import type { Asset } from "@domain/assets/AssetDomain";
import { AssetGeneratedOutputRegistrationService } from "../use-cases/AssetGeneratedOutputRegistrationService";
import type { AssetAuditEvent, AssetAuditSink } from "../ports/AssetAuditPort";

class InMemoryAssetRepository implements IAssetRepository {
  private readonly records = new Map<string, Asset>();
  public readonly lineageByAssetId = new Map<string, ReadonlyArray<{
    readonly sourceAssetId: string;
    readonly sourceAssetVersionId?: string;
    readonly relation?: string;
  }>>();
  public readonly sourcesByAssetId = new Map<string, {
    readonly producerType: "run" | "system";
    readonly runId?: string;
    readonly systemId?: string;
  }>();

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.records.get(assetId);
  }

  public async listAssets(
    _query: Parameters<IAssetRepository["listAssets"]>[0],
  ): Promise<ReadonlyArray<Asset>> {
    return Object.freeze([...this.records.values()]);
  }

  public async createAsset(asset: Asset) {
    if (this.records.has(asset.id)) {
      throw new Error(`Asset '${asset.id}' already exists.`);
    }
    this.records.set(asset.id, asset);
    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async saveAsset(asset: Asset) {
    this.records.set(asset.id, asset);
    return Object.freeze({
      changed: true,
      asset,
    });
  }

  public async replaceAssetLineage(
    assetId: string,
    lineage: ReadonlyArray<{
      readonly sourceAssetId: string;
      readonly sourceAssetVersionId?: string;
      readonly relation?: string;
    }>,
  ): Promise<void> {
    this.lineageByAssetId.set(assetId, Object.freeze([...lineage]));
  }

  public async replaceAssetGeneratedOutputSource(
    assetId: string,
    source: {
      readonly producerType: "run" | "system";
      readonly runId?: string;
      readonly systemId?: string;
    },
  ): Promise<void> {
    this.sourcesByAssetId.set(assetId, source);
  }
}

class WorkspaceAuthorizationRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;
  public isAdmin = false;

  public async getWorkspaceAuthorizationSnapshot(
    query: Parameters<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>[0],
  ): Promise<Awaited<ReturnType<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>>> {
    if (!this.allow) {
      return undefined;
    }
    return Object.freeze({
      workspace: {
        id: query.workspaceId,
        slug: "workspace-alpha",
        displayName: "Workspace Alpha",
        status: "active",
        ownership: {
          workspaceId: query.workspaceId,
          ownerUserId: "user-owner",
          visibility: "team",
          createdBy: "user-owner",
          lastModifiedBy: "user-owner",
          createdAt: "2026-04-06T10:00:00.000Z",
          lastModifiedAt: "2026-04-06T10:00:00.000Z",
        },
      },
      membership: {
        id: "membership-alpha",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: "active",
        createdAt: "2026-04-06T10:00:00.000Z",
        updatedAt: "2026-04-06T10:00:00.000Z",
        createdBy: query.userIdentityId,
        lastModifiedBy: query.userIdentityId,
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: this.isAdmin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

class StorageRepository implements IStorageInstanceRepository {
  public instance: StorageInstance = createStorageInstance({
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
      maxObjectBytes: 1024 * 1024,
      encryption: {
        profileId: "profile-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-06T10:00:00.000Z",
    lastCorrelationId: "corr-seed-storage",
  });

  public async findStorageInstanceById(_storageInstanceId: string): Promise<StorageInstance | undefined> {
    return this.instance;
  }

  public async listStorageInstances(_query: any): Promise<ReadonlyArray<StorageInstance>> {
    return Object.freeze([this.instance]);
  }

  public async createStorageInstance(_storageInstance: any, _mutation: any): Promise<any> {
    throw new Error("not used");
  }

  public async saveStorageInstance(_storageInstance: any, _mutation: any): Promise<any> {
    throw new Error("not used");
  }
}

class StoragePolicyPort implements IStoragePolicyEvaluationPort {
  public async evaluateStorageAction(
    input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0],
  ): Promise<Awaited<ReturnType<IStoragePolicyEvaluationPort["evaluateStorageAction"]>>> {
    return Object.freeze({
      allowed: true,
      reasonCode: "allowed",
      occurredAt: input.occurredAt ?? "2026-04-06T12:00:00.000Z",
    });
  }

  public async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

class RecordingAuditSink implements AssetAuditSink {
  public readonly events: AssetAuditEvent[] = [];

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function buildService(auditSink?: AssetAuditSink) {
  const repository = new InMemoryAssetRepository();
  const workspaceAuthorizationReadRepository = new WorkspaceAuthorizationRepository();
  const storageInstanceRepository = new StorageRepository();
  const storagePolicyEvaluationPort = new StoragePolicyPort();
  const service = new AssetGeneratedOutputRegistrationService({
    repository,
    workspaceAuthorizationReadRepository,
    storageInstanceRepository,
    storagePolicyEvaluationPort,
    auditSink,
    clock: {
      now: () => new Date("2026-04-06T12:00:00.000Z"),
    },
  });

  return {
    service,
    repository,
    workspaceAuthorizationReadRepository,
  };
}

describe("AssetGeneratedOutputRegistrationService", () => {
  it("registers generated outputs with lineage and producer metadata", async () => {
    const { service, repository } = buildService();

    const outcome = await service.registerGeneratedOutput({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:output:register:1",
      assetId: "asset-generated-001",
      storageInstanceId: "storage-alpha",
      outputVersion: {
        versionId: "asset-generated-001:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-generated-001/output/v1/result.json",
        area: "output",
        content: {
          mimeType: "application/json",
          sizeBytes: 320,
          checksum: {
            algorithm: "sha256",
            digest: "a".repeat(64),
          },
          originalFileName: "result.json",
        },
      },
      source: {
        producerType: "run",
        runId: "execution-run-001",
        systemId: "system-image-generation",
      },
      lineage: [{
        sourceAssetId: "asset-input-001",
        sourceAssetVersionId: "asset-input-001:v3",
        relation: "generated-from",
      }],
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.asset.kind).toBe("generated-output");
    expect(outcome.value.asset.ownership.ownerUserId).toBeUndefined();
    expect(outcome.value.asset.visibility).toBe("workspace");
    expect(repository.lineageByAssetId.get("asset-generated-001")).toHaveLength(1);
    expect(repository.sourcesByAssetId.get("asset-generated-001")).toEqual({
      producerType: "run",
      runId: "execution-run-001",
      systemId: "system-image-generation",
    });
  });

  it("rejects non-admin ownership delegation for generated outputs", async () => {
    const { service } = buildService();
    const denied = await service.registerGeneratedOutput({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:output:register:denied",
      assetId: "asset-generated-002",
      ownerUserId: "user-other",
      visibility: "private",
      storageInstanceId: "storage-alpha",
      outputVersion: {
        versionId: "asset-generated-002:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-generated-002/output/v1/result.png",
        area: "output",
        content: {
          mimeType: "image/png",
          sizeBytes: 64,
          checksum: {
            algorithm: "sha256",
            digest: "b".repeat(64),
          },
        },
      },
      source: {
        producerType: "system",
        systemId: "system-render",
      },
      lineage: [],
    });

    expect(denied.ok).toBeFalse();
    if (denied.ok) {
      return;
    }
    expect(denied.error.code).toBe("asset-access-denied");
  });

  it("rejects generated output registration without workspace access", async () => {
    const { service, workspaceAuthorizationReadRepository } = buildService();
    workspaceAuthorizationReadRepository.allow = false;

    const denied = await service.registerGeneratedOutput({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:output:register:no-access",
      assetId: "asset-generated-003",
      storageInstanceId: "storage-alpha",
      outputVersion: {
        versionId: "asset-generated-003:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-generated-003/output/v1/result.png",
        area: "output",
        content: {
          mimeType: "image/png",
          sizeBytes: 64,
          checksum: {
            algorithm: "sha256",
            digest: "c".repeat(64),
          },
        },
      },
      source: {
        producerType: "system",
        systemId: "system-render",
      },
      lineage: [],
    });

    expect(denied.ok).toBeFalse();
    if (denied.ok) {
      return;
    }
    expect(denied.error.code).toBe("asset-access-denied");
  });

  it("emits audit events for generated output registration", async () => {
    const auditSink = new RecordingAuditSink();
    const { service } = buildService(auditSink);

    const outcome = await service.registerGeneratedOutput({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      operationKey: "asset:output:register:4",
      assetId: "asset-generated-004",
      storageInstanceId: "storage-alpha",
      outputVersion: {
        versionId: "asset-generated-004:v1",
        storageInstanceId: "storage-alpha",
        objectKey: "workspaces/workspace-alpha/assets/asset-generated-004/output/v1/result.png",
        area: "output",
        content: {
          mimeType: "image/png",
          sizeBytes: 64,
          checksum: {
            algorithm: "sha256",
            digest: "d".repeat(64),
          },
        },
      },
      source: {
        producerType: "system",
        systemId: "system-render",
      },
      lineage: [],
    });

    expect(outcome.ok).toBeTrue();
    expect(auditSink.events).toHaveLength(1);
    expect(auditSink.events[0]?.type).toBe("asset-generated-output-registered");
    expect(auditSink.events[0]?.outcome).toBe("success");
  });
});

