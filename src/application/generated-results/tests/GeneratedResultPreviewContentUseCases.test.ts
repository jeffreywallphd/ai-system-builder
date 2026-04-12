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
import type {
  CreateGeneratedResultPreviewAccessDescriptorRequest,
  CreateGeneratedResultPreviewAccessDescriptorResult,
  ResolveGeneratedResultPreviewAccessDescriptorRequest,
  ResolveGeneratedResultPreviewAccessDescriptorResult,
} from "../ports/GeneratedResultPreviewGenerationPorts";
import { WorkspaceMembershipStatuses, WorkspaceRoles } from "@domain/workspaces/WorkspaceDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import { GeneratedResultDerivativeAvailabilityStatuses } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { RequestGeneratedResultPreviewContentUseCase } from "../use-cases/RequestGeneratedResultPreviewContentUseCase";
import { OpenGeneratedResultPreviewContentUseCase } from "../use-cases/OpenGeneratedResultPreviewContentUseCase";
import { GeneratedResultPreviewContentReadErrorCodes } from "../use-cases/GetGeneratedResultPreviewContentUseCaseContracts";
import type { GeneratedResultAuditEvent, GeneratedResultAuditSink } from "../ports/GeneratedResultAuditPort";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();
  public readonly previews = new Map<string, GeneratedResultPreviewPersistenceRecord[]>();

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
    this.previews.set(record.resultAssetId, Object.freeze([record]));
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record,
    });
  }

  public async listPreviewsByResultId(resultAssetId: string): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return this.previews.get(resultAssetId) ?? Object.freeze([]);
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

class StubGeneratedResultPreviewAccessPort {
  public readonly claimsByHandle = new Map<string, ResolveGeneratedResultPreviewAccessDescriptorResult>();

  public createPreviewAccessDescriptor(
    _request: CreateGeneratedResultPreviewAccessDescriptorRequest,
  ): CreateGeneratedResultPreviewAccessDescriptorResult {
    throw new Error("not used");
  }

  public resolvePreviewAccessDescriptor(
    request: ResolveGeneratedResultPreviewAccessDescriptorRequest,
  ): ResolveGeneratedResultPreviewAccessDescriptorResult | undefined {
    return this.claimsByHandle.get(request.accessHandle);
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
    status: GeneratedResultAssetStatuses.previewReady,
    pendingSince: "2026-04-08T10:00:00.000Z",
    logicalAssetVersionId: "logical-version-1",
    persistedAt: "2026-04-08T10:01:00.000Z",
    persistedBy: "user-owner",
    previewReadyAt: "2026-04-08T10:02:00.000Z",
    previewReadyBy: "user-owner",
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

function buildPreviewRecord(input?: Partial<GeneratedResultPreviewPersistenceRecord>): GeneratedResultPreviewPersistenceRecord {
  return Object.freeze({
    derivativeId: "gr-preview-001",
    resultAssetId: "gr-asset-001",
    resultLogicalAssetVersionId: "logical-version-1",
    previewKind: "display-safe",
    availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.available,
    isPrimaryPreview: true,
    protectedResourceId: "protected-resource://gr-preview-001",
    accessHandle: "preview-access://generated-results/preview-token-001",
    mediaType: "image/webp",
    width: 512,
    height: 512,
    byteSize: 4096,
    generatedAt: "2026-04-08T10:02:00.000Z",
    failureCode: undefined,
    failureMessage: undefined,
    tenancy: Object.freeze({
      scope: "workspace",
      workspaceId: "workspace-alpha",
      userIdentityId: undefined,
      nodeId: undefined,
    }),
    createdAt: "2026-04-08T10:02:00.000Z",
    createdBy: "user-owner",
    lastModifiedAt: "2026-04-08T10:02:00.000Z",
    lastModifiedBy: "user-owner",
    revision: 1,
    schemaVersion: 1,
    ...input,
  });
}

describe("Generated result preview content use cases", () => {
  it("returns preview-available with tokenized protected access", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const auditSink = new InMemoryGeneratedResultAuditSink();
    repository.records.set("gr-asset-001", buildResultRecord());
    repository.previews.set("gr-asset-001", Object.freeze([buildPreviewRecord()]));

    const requestUseCase = new RequestGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
      auditSink,
    });

    const outcome = await requestUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.state).toBe("preview-available");
    expect(outcome.value.available).toBeTrue();
    expect(outcome.value.selected?.previewToken).toBe("preview-token-001");
    expect(auditSink.events.some((event) => (
      event.type === "generated-result-preview-access-requested"
      && event.outcome === "success"
      && event.result.resultAssetId === "gr-asset-001"
    ))).toBeTrue();
  });

  it("returns preview-pending when preview generation is still pending", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord());
    repository.previews.set("gr-asset-001", Object.freeze([buildPreviewRecord({
      availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.pending,
      accessHandle: undefined,
      mediaType: undefined,
    })]));

    const requestUseCase = new RequestGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
    });

    const outcome = await requestUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.state).toBe("preview-pending");
    expect(outcome.value.available).toBeFalse();
    expect(outcome.value.reasonCode).toBe("preview-pending");
  });

  it("returns preview-failed when derivative generation failed", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord());
    repository.previews.set("gr-asset-001", Object.freeze([buildPreviewRecord({
      availabilityStatus: GeneratedResultDerivativeAvailabilityStatuses.failed,
      accessHandle: undefined,
      mediaType: undefined,
      failureCode: "preview-generation-failed",
    })]));

    const requestUseCase = new RequestGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
    });

    const outcome = await requestUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.state).toBe("preview-failed");
    expect(outcome.value.reasonCode).toBe("preview-generation-failed");
  });

  it("returns preview-unavailable when no preview descriptors exist", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord());

    const requestUseCase = new RequestGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
    });

    const outcome = await requestUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.state).toBe("preview-unavailable");
    expect(outcome.value.reasonCode).toBe("preview-missing");
  });

  it("blocks preview requests when workspace membership is not active", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord());

    const requestUseCase = new RequestGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(false),
    });

    const outcome = await requestUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(GeneratedResultPreviewContentReadErrorCodes.accessDenied);
  });

  it("opens preview content stream for valid preview tokens", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const auditSink = new InMemoryGeneratedResultAuditSink();
    repository.records.set("gr-asset-001", buildResultRecord());
    repository.previews.set("gr-asset-001", Object.freeze([buildPreviewRecord()]));

    const previewAccessPort = new StubGeneratedResultPreviewAccessPort();
    previewAccessPort.claimsByHandle.set(
      "preview-access://generated-results/preview-token-001",
      Object.freeze({
        workspaceId: "workspace-alpha",
        resultAssetId: "gr-asset-001",
        derivativeId: "gr-preview-001",
        previewKind: "display-safe",
        storageInstanceId: "storage-alpha",
        objectKey: "generated-results/gr-asset-001/previews/display-safe.webp",
        occurredAt: "2026-04-08T10:02:00.000Z",
      }),
    );

    const storageObjectPort = new InMemoryStorageObjectPort();
    storageObjectPort.objects.set(
      "storage-alpha:generated-results/gr-asset-001/previews/display-safe.webp",
      Buffer.from("hello", "utf8"),
    );

    const openUseCase = new OpenGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(storageObjectPort),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
      previewAccessPort: previewAccessPort as never,
      auditSink,
    });

    const outcome = await openUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      previewToken: "preview-token-001",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.mediaType).toBe("image/webp");
    expect(outcome.value.contentDisposition).toBe("inline");
    const chunks: number[] = [];
    for await (const chunk of outcome.value.stream) {
      chunks.push(...chunk);
    }
    expect(Buffer.from(chunks).toString("utf8")).toBe("hello");
    expect(auditSink.events.some((event) => (
      event.type === "generated-result-preview-content-opened"
      && event.outcome === "success"
      && event.result.resultAssetId === "gr-asset-001"
    ))).toBeTrue();
  });

  it("returns invalid-state for stale preview tokens", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    repository.records.set("gr-asset-001", buildResultRecord());
    repository.previews.set("gr-asset-001", Object.freeze([buildPreviewRecord()]));

    const openUseCase = new OpenGeneratedResultPreviewContentUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(new InMemoryStorageObjectPort()),
      workspaceAuthorizationReadRepository: new StaticWorkspaceAuthorizationReadRepository(true),
      previewAccessPort: new StubGeneratedResultPreviewAccessPort() as never,
    });

    const outcome = await openUseCase.execute({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      resultAssetId: "gr-asset-001",
      previewToken: "invalid-token",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe(GeneratedResultPreviewContentReadErrorCodes.invalidState);
    expect(outcome.error.details?.staleRequest).toBeTrue();
  });
});
