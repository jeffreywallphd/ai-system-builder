import { describe, expect, it } from "bun:test";
import type {
  GeneratedResultLineageRecord,
  GeneratedResultRecordListQuery,
  IGeneratedResultPersistenceRepository,
} from "../ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import type {
  IStorageLogicalAccessResolutionService,
  ResolveStorageLogicalAccessCommand,
  StorageLogicalAccessResolutionPlan,
  StorageLogicalAccessResolutionResult,
} from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type {
  CreateStorageObjectKeyRequest,
  CreateStorageObjectKeyResult,
  IStorageObjectPort,
  StorageObjectDeleteRequest,
  StorageObjectDeleteResult,
  StorageObjectMetadata,
  StorageObjectReference,
  StorageObjectWriteRequest,
  StorageObjectWriteResult,
} from "@application/storage/ports/StorageObjectPort";
import { GeneratedResultAssetStatuses } from "@domain/image-assets/GeneratedResultAssetDomain";
import { GeneratedResultDerivativeAvailabilityStatuses } from "@domain/image-assets/GeneratedResultAssetDerivativeDomain";
import { AssetVisibilities } from "@domain/assets/AssetDomain";
import { GenerateGeneratedResultPreviewUseCase } from "../use-cases/GenerateGeneratedResultPreviewUseCase";
import { SharpGeneratedResultPreviewImageProcessor } from "@infrastructure/media/generated-results/SharpGeneratedResultPreviewImageProcessor";
import { TokenizedGeneratedResultPreviewAccessPort } from "@infrastructure/media/generated-results/TokenizedGeneratedResultPreviewAccessPort";
import type { GeneratedResultAuditEvent, GeneratedResultAuditSink } from "../ports/GeneratedResultAuditPort";

const TinyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ioAAAAASUVORK5CYII=";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();
  public readonly previews = new Map<string, GeneratedResultPreviewPersistenceRecord>();

  public async findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined> {
    return this.records.get(resultAssetId);
  }

  public async listResults(
    _query: GeneratedResultRecordListQuery,
  ): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()]);
  }

  public async listResultsByRun(
    input: Parameters<IGeneratedResultPersistenceRepository["listResultsByRun"]>[0],
  ): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()].filter((entry) =>
      entry.workspaceId === input.workspaceId && entry.runId === input.runId,
    ));
  }

  public async createResult(
    record: GeneratedResultPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    this.records.set(record.resultAssetId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async saveResult(
    record: GeneratedResultPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPersistenceRecord>> {
    this.records.set(record.resultAssetId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>> {
    this.previews.set(record.derivativeId, record);
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async listPreviewsByResultId(resultAssetId: string): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze([...this.previews.values()].filter((entry) => entry.resultAssetId === resultAssetId));
  }

  public async getLineageByResultId(_resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined> {
    return undefined;
  }
}

class InMemoryStorageObjectPort implements IStorageObjectPort {
  public readonly objects = new Map<string, Uint8Array>();

  public createObjectKey(input: CreateStorageObjectKeyRequest): CreateStorageObjectKeyResult {
    return Object.freeze({
      objectKey: [
        input.namespace,
        ...input.logicalPathSegments,
        input.originalFileName ?? "preview.webp",
      ].join("/"),
      normalizedFileName: input.originalFileName ?? "preview.webp",
      partition: Object.freeze([]),
    });
  }

  public async writeObject(input: StorageObjectWriteRequest): Promise<StorageObjectWriteResult> {
    const key = this.key(input.reference);
    const chunks: Uint8Array[] = [];
    if (input.content instanceof Uint8Array) {
      chunks.push(input.content);
    } else {
      for await (const chunk of input.content) {
        chunks.push(chunk);
      }
    }
    const payload = Buffer.concat(chunks.map((entry) => Buffer.from(entry)));
    this.objects.set(key, payload);

    return Object.freeze({
      objectKey: input.reference.objectKey,
      sizeBytes: payload.byteLength,
      checksum: Object.freeze({
        algorithm: "sha256",
        digest: "a".repeat(64),
      }),
      writtenAt: "2026-04-08T12:00:01.000Z",
    });
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
      lastModifiedAt: "2026-04-08T12:00:00.000Z",
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

  public async deleteObject(input: StorageObjectDeleteRequest): Promise<StorageObjectDeleteResult> {
    return Object.freeze({
      objectKey: input.reference.objectKey,
      deleted: this.objects.delete(this.key(input.reference)),
      deletedAt: "2026-04-08T12:00:02.000Z",
    });
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
    return {
      ok: true,
      value: Object.freeze({
        intent: command.intent,
        occurredAt: command.occurredAt ?? "2026-04-08T12:00:00.000Z",
        storageInstance: Object.freeze({
          id: command.storageInstanceId,
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

function createResultRecord(overrides?: Partial<GeneratedResultPersistenceRecord>): GeneratedResultPersistenceRecord {
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
    inputAssetIds: Object.freeze(["asset-input-001"]),
    workflowTemplateVersionId: undefined,
    workflowTemplateVersionTag: undefined,
    systemSnapshotId: undefined,
    systemVersionTag: undefined,
    parameterSnapshotId: undefined,
    selectedNodeId: undefined,
    executionAdapterKind: "comfyui",
    executionBackendFamily: "comfyui",
    visibility: AssetVisibilities.workspace,
    sharingPolicyId: undefined,
    sharingPolicyVersion: undefined,
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/generated-results/run-001/output-original.png",
    mediaType: "image/png",
    status: GeneratedResultAssetStatuses.available,
    pendingSince: "2026-04-08T12:00:00.000Z",
    logicalAssetVersionId: "storage-instance://storage-alpha/generated-results/run-001/output-original.png",
    persistedAt: "2026-04-08T12:00:00.000Z",
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
    }),
    createdAt: "2026-04-08T12:00:00.000Z",
    createdBy: "user-owner",
    lastModifiedAt: "2026-04-08T12:00:00.000Z",
    lastModifiedBy: "user-owner",
    revision: 1,
    schemaVersion: 1,
    ...overrides,
  });
}

describe("GenerateGeneratedResultPreviewUseCase", () => {
  it("generates preview derivatives, persists protected descriptors, and updates preview-ready lifecycle", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const auditSink = new InMemoryGeneratedResultAuditSink();
    const storageService = new StaticStorageLogicalAccessResolutionService(objectPort);
    const processor = new SharpGeneratedResultPreviewImageProcessor();
    const previewAccessPort = new TokenizedGeneratedResultPreviewAccessPort("preview-secret-alpha");

    repository.records.set("gr-asset-001", createResultRecord());
    objectPort.objects.set(
      "storage-alpha:generated-results/run-001/output-original.png",
      Buffer.from(TinyPngBase64, "base64"),
    );

    const useCase = new GenerateGeneratedResultPreviewUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: storageService,
      previewImageProcessorPort: processor,
      previewAccessPort,
      auditSink,
    });

    const outcome = await useCase.execute({
      resultAssetId: "gr-asset-001",
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      operationKey: "op:preview-generate:001",
      occurredAt: "2026-04-08T12:00:01.000Z",
    });

    expect(outcome.ok).toBeTrue();
    if (!outcome.ok) {
      return;
    }
    expect(outcome.value.previewKind).toBe("display-safe");
    expect(outcome.value.mediaType).toBe("image/webp");
    expect(outcome.value.protectedResourceId).toMatch(/^protected-resource:\/\//);
    expect(outcome.value.accessHandle).toMatch(/^preview-access:\/\//);

    const persistedPreview = [...repository.previews.values()][0];
    expect(persistedPreview?.availabilityStatus).toBe(GeneratedResultDerivativeAvailabilityStatuses.available);
    expect(persistedPreview?.protectedResourceId).toBeDefined();
    expect(persistedPreview?.accessHandle).toBeDefined();

    const persistedResult = repository.records.get("gr-asset-001");
    expect(persistedResult?.status).toBe(GeneratedResultAssetStatuses.previewReady);
    expect(persistedResult?.previewReadyAt).toBe("2026-04-08T12:00:01.000Z");

    const writtenKeys = [...objectPort.objects.keys()].filter((entry) =>
      entry.startsWith("storage-alpha:workspaces/workspace-alpha/generated-results/gr-asset-001/previews/display-safe/"),
    );
    expect(writtenKeys.length).toBe(1);
    expect(auditSink.events.some((event) => (
      event.type === "generated-result-preview-generation-recorded"
      && event.outcome === "success"
      && event.result.resultAssetId === "gr-asset-001"
    ))).toBeTrue();
  });

  it("persists failed preview descriptors when source references are unavailable", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const objectPort = new InMemoryStorageObjectPort();
    const auditSink = new InMemoryGeneratedResultAuditSink();
    const storageService = new StaticStorageLogicalAccessResolutionService(objectPort);
    const processor = new SharpGeneratedResultPreviewImageProcessor();
    const previewAccessPort = new TokenizedGeneratedResultPreviewAccessPort("preview-secret-alpha");

    repository.records.set("gr-asset-001", createResultRecord({
      storageBindingReference: "storage-instance://storage-alpha",
      logicalAssetVersionId: undefined,
    }));

    const useCase = new GenerateGeneratedResultPreviewUseCase({
      generatedResultRepository: repository,
      storageLogicalAccessResolutionService: storageService,
      previewImageProcessorPort: processor,
      previewAccessPort,
      auditSink,
    });

    const outcome = await useCase.execute({
      resultAssetId: "gr-asset-001",
      workspaceId: "workspace-alpha",
      actorUserId: "user-owner",
      operationKey: "op:preview-generate:002",
      occurredAt: "2026-04-08T12:00:01.000Z",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("generated-result-preview-generation-source-unavailable");
    expect([...repository.previews.values()][0]?.availabilityStatus).toBe(GeneratedResultDerivativeAvailabilityStatuses.failed);
    expect(auditSink.events.some((event) => (
      event.type === "generated-result-preview-generation-recorded"
      && event.outcome === "failed"
      && event.result.resultAssetId === "gr-asset-001"
    ))).toBeTrue();
  });
});
