import { describe, expect, it } from "bun:test";
import type {
  GeneratedResultLineageRecord,
  GeneratedResultRecordListQuery,
  IGeneratedResultPersistenceRepository,
} from "../ports/IGeneratedResultPersistenceRepository";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import type {
  IStorageLogicalAccessResolutionService,
  ResolveStorageLogicalAccessCommand,
  StorageLogicalAccessResolutionPlan,
  StorageLogicalAccessResolutionResult,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type {
  StorageObjectMetadata,
  StorageObjectReference,
  IStorageObjectPort,
} from "@application/storage/ports/StorageObjectPort";
import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import {
  GetGeneratedResultOriginalContentUseCase,
} from "../use-cases/GetGeneratedResultOriginalContentUseCase";
import { GeneratedResultOriginalContentReadErrorCodes } from "../use-cases/GetGeneratedResultOriginalContentUseCaseContracts";
import type { GeneratedResultAuditEvent, GeneratedResultAuditSink } from "../ports/GeneratedResultAuditPort";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();

  public async findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined> {
    return this.records.get(resultAssetId.trim());
  }

  public async listResults(
    _query: GeneratedResultRecordListQuery,
  ): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()]);
  }

  public async listResultsByRun(): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()]);
  }

  public async createResult(
    record: GeneratedResultPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    this.records.set(record.resultAssetId, record);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record,
    });
  }

  public async saveResult(
    record: GeneratedResultPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    this.records.set(record.resultAssetId, record);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record,
    });
  }

  public async savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record,
    });
  }

  public async listPreviewsByResultId(): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze([]);
  }

  public async getLineageByResultId(): Promise<GeneratedResultLineageRecord | undefined> {
    return undefined;
  }
}

class StaticWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  public constructor(private readonly active = true) {}

  public async getWorkspaceAuthorizationSnapshot(
    query: WorkspaceAuthorizationSnapshotQuery,
  ): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    if (!this.active || query.workspaceId !== "workspace-alpha") {
      return undefined;
    }

    return Object.freeze({
      workspaceId: "workspace-alpha",
      userIdentityId: query.userIdentityId,
      isWorkspaceOwner: query.userIdentityId === "user-owner",
      membership: Object.freeze({
        workspaceId: "workspace-alpha",
        userIdentityId: query.userIdentityId,
        role: query.userIdentityId === "user-owner" ? WorkspaceRoles.owner : WorkspaceRoles.member,
        status: WorkspaceMembershipStatuses.active,
        invitedByUserIdentityId: "user-owner",
        invitedAt: "2026-04-08T10:00:00.000Z",
        acceptedAt: "2026-04-08T10:00:00.000Z",
        createdAt: "2026-04-08T10:00:00.000Z",
        updatedAt: "2026-04-08T10:00:00.000Z",
      }),
      effectiveRoles: Object.freeze(
        query.userIdentityId === "user-owner" ? [WorkspaceRoles.owner] : [WorkspaceRoles.member],
      ),
      activePermissionGrantIds: Object.freeze([]),
      activeSharingGrantIds: Object.freeze([]),
      resolvedAt: "2026-04-08T10:00:00.000Z",
    });
  }
}

class InMemoryStorageObjectPort implements IStorageObjectPort {
  public readonly objects = new Map<string, Uint8Array>();

  public createObjectKey(): never {
    throw new Error("not used");
  }

  public async writeObject(): Promise<never> {
    throw new Error("not used");
  }

  public async objectExists(reference: StorageObjectReference): Promise<boolean> {
    return this.objects.has(this.key(reference));
  }

  public async readObjectMetadata(reference: StorageObjectReference): Promise<StorageObjectMetadata> {
    const payload = this.objects.get(this.key(reference));
    if (!payload) {
      throw new Error("not found");
    }
    return Object.freeze({
      objectKey: reference.objectKey,
      sizeBytes: payload.byteLength,
      lastModifiedAt: "2026-04-08T10:00:00.000Z",
    });
  }

  public async openObjectReadStream(reference: StorageObjectReference): Promise<AsyncIterable<Uint8Array>> {
    const payload = this.objects.get(this.key(reference));
    if (!payload) {
      throw new Error("not found");
    }
    return (async function* stream() {
      yield payload;
    })();
  }

  public async deleteObject(): Promise<never> {
    throw new Error("not used");
  }

  private key(reference: StorageObjectReference): string {
    return `${reference.storageInstance.id}:${reference.objectKey}`;
  }
}

class StaticStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public constructor(private readonly objectPort: IStorageObjectPort) {}

  public async resolveLogicalAccessPlan(
    command: ResolveStorageLogicalAccessCommand,
  ): Promise<StorageLogicalAccessResolutionResult<StorageLogicalAccessResolutionPlan>> {
    if (command.storageInstanceId !== "storage-alpha") {
      return {
        ok: false,
        error: Object.freeze({
          code: "storage-logical-access-not-found",
          message: "storage instance not found",
        }),
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        intent: command.intent,
        occurredAt: command.occurredAt ?? "2026-04-08T10:00:00.000Z",
        storageInstance: Object.freeze({
          id: "storage-alpha",
          ownership: Object.freeze({
            workspaceId: command.workspaceId,
          }),
        }),
        objectPort: this.objectPort,
      } as unknown as StorageLogicalAccessResolutionPlan),
    };
  }
}

class InMemoryGeneratedResultAuditSink implements GeneratedResultAuditSink {
  public readonly events: GeneratedResultAuditEvent[] = [];

  public async recordGeneratedResultEvent(event: GeneratedResultAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

function buildResultRecord(input?: Partial<GeneratedResultPersistenceRecord>): GeneratedResultPersistenceRecord {
  return Object.freeze({
    resultAssetId: "gr-asset-001",
    workspaceId: "workspace-alpha",
    ownerUserId: "user-owner",
    runId: "run-001",
    systemId: "system-001",
    workflowId: "workflow-001",
    workflowTemplateId: undefined,
    executionNodeId: undefined,
    outputSlot: "primary",
    inputAssetIds: Object.freeze(["image-asset:source-001"]),
    workflowTemplateVersionId: undefined,
    workflowTemplateVersionTag: undefined,
    systemSnapshotId: undefined,
    systemVersionTag: undefined,
    parameterSnapshotId: undefined,
    selectedNodeId: undefined,
    executionAdapterKind: "comfyui",
    executionBackendFamily: "comfy",
    visibility: AssetVisibilities.private,
    sharingPolicyId: undefined,
    sharingPolicyVersion: undefined,
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
    mediaType: "image/png",
    status: GeneratedResultAssetStatuses.available,
    pendingSince: "2026-04-08T10:00:00.000Z",
    logicalAssetVersionId: undefined,
    persistedAt: "2026-04-08T10:01:00.000Z",
    persistedBy: "user-owner",
    previewReadyAt: undefined,
    previewReadyBy: undefined,
    failedAt: undefined,
    failedBy: undefined,
    failureCode: undefined,
    failureMessage: undefined,
    archivedAt: undefined,
    archivedBy: undefined,
    tenancy: Object.freeze({
      scope: "workspace",
      workspaceId: "workspace-alpha",
      userIdentityId: undefined,
      nodeId: undefined,
    }),
    createdAt: "2026-04-08T10:00:00.000Z",
    createdBy: "user-owner",
    lastModifiedAt: "2026-04-08T10:01:00.000Z",
    lastModifiedBy: "user-owner",
    revision: 1,
    schemaVersion: 1,
    ...input,
  });
}

describe("GetGeneratedResultOriginalContentUseCase", () => {
  it("streams generated-result original content for authorized workspace members", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const auditSink = new InMemoryGeneratedResultAuditSink();
    objectPort.objects.set("storage-alpha:generated-results/run-001/output-001.png", Buffer.from("hello", "utf8"));
    repository.records.set("gr-asset-001", buildResultRecord());

    const useCase = new GetGeneratedResultOriginalContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(objectPort),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
      auditSink,
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.mediaType).toBe("image/png");
    expect(outcome.value.sizeBytes).toBe(5);
    expect(outcome.value.contentDisposition).toBe("attachment");

    const chunks: number[] = [];
    for await (const chunk of outcome.value.stream) {
      chunks.push(...chunk);
    }
    expect(Buffer.from(chunks).toString("utf8")).toBe("hello");
    expect(auditSink.events.some((event) => (
      event.type === "generated-result-original-content-accessed"
      && event.outcome === "success"
      && event.result.resultAssetId === "gr-asset-001"
    ))).toBeTrue();
  });

  it("blocks callers without active workspace membership", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord());
    const objectPort = new InMemoryStorageObjectPort();

    const useCase = new GetGeneratedResultOriginalContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(objectPort),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(false),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(GeneratedResultOriginalContentReadErrorCodes.accessDenied);
  });

  it("returns content-unavailable when no resolvable storage object reference exists", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord({
      storageBindingReference: "storage-instance://storage-alpha/generated-results",
      logicalAssetVersionId: undefined,
    }));
    const objectPort = new InMemoryStorageObjectPort();

    const useCase = new GetGeneratedResultOriginalContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(objectPort),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(GeneratedResultOriginalContentReadErrorCodes.contentUnavailable);
  });

  it("hides private results from non-owner members without workspace-admin role", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord({
      ownerUserId: "user-owner",
      visibility: AssetVisibilities.private,
    }));
    const objectPort = new InMemoryStorageObjectPort();

    const useCase = new GetGeneratedResultOriginalContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(objectPort),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-member",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(GeneratedResultOriginalContentReadErrorCodes.notFound);
  });

  it("returns invalid-state when retrieval is requested before persistence lifecycle becomes retrievable", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord({
      status: GeneratedResultAssetStatuses.pending,
    }));
    const objectPort = new InMemoryStorageObjectPort();

    const useCase = new GetGeneratedResultOriginalContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(objectPort),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
    });

    const outcome = await useCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(GeneratedResultOriginalContentReadErrorCodes.invalidState);
  });
});
