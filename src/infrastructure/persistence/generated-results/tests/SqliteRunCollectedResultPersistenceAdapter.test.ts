import { describe, expect, it } from "bun:test";
import type { IGeneratedResultPersistenceRepository } from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import type { GeneratedResultLineageRecord } from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import type {
  IPersistenceDiagnosticsLogger,
  PersistenceDiagnosticsLogEvent,
} from "@infrastructure/logging/PersistenceDiagnosticsLogger";
import type { IGenerateGeneratedResultPreviewUseCase } from "@application/generated-results/use-cases/GenerateGeneratedResultPreviewUseCaseContracts";
import { SqliteRunCollectedResultPersistenceAdapter } from "../SqliteRunCollectedResultPersistenceAdapter";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();
  public readonly previews = new Map<string, GeneratedResultPreviewPersistenceRecord>();
  public readonly throwOnResultAssetIds = new Set<string>();
  public readonly throwOnResultErrorMessages = new Map<string, string>();
  public readonly throwOnPreviewDerivativeIds = new Set<string>();
  public throwOnAnyPreviewSave = false;
  public remainingPreviewSaveFailures = 0;

  public async findResultById(resultAssetId: string): Promise<GeneratedResultPersistenceRecord | undefined> {
    return this.records.get(resultAssetId);
  }

  public async listResults(
    _query: Parameters<IGeneratedResultPersistenceRepository["listResults"]>[0],
  ): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()]);
  }

  public async listResultsByRun(input: {
    readonly workspaceId: string;
    readonly runId: string;
  }): Promise<ReadonlyArray<GeneratedResultPersistenceRecord>> {
    return Object.freeze([...this.records.values()].filter((record) =>
      record.workspaceId === input.workspaceId && record.runId === input.runId,
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
    if (this.throwOnResultAssetIds.has(record.resultAssetId)) {
      const message = this.throwOnResultErrorMessages.get(record.resultAssetId)
        ?? `Temporary storage unavailable for ${record.resultAssetId}`;
      throw new Error(message);
    }
    const changed = JSON.stringify(this.records.get(record.resultAssetId)) !== JSON.stringify(record);
    this.records.set(record.resultAssetId, record);
    return Object.freeze({ record, changed, wasReplay: false });
  }

  public async savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>> {
    if (this.throwOnPreviewDerivativeIds.has(record.derivativeId)) {
      throw new Error(`Preview storage unavailable for ${record.derivativeId}`);
    }
    if (this.throwOnAnyPreviewSave) {
      throw new Error("Preview storage unavailable");
    }
    if (this.remainingPreviewSaveFailures > 0) {
      this.remainingPreviewSaveFailures -= 1;
      throw new Error("Preview storage unavailable");
    }
    const changed = JSON.stringify(this.previews.get(record.derivativeId)) !== JSON.stringify(record);
    this.previews.set(record.derivativeId, record);
    return Object.freeze({ record, changed, wasReplay: false });
  }

  public async listPreviewsByResultId(
    resultAssetId: string,
  ): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze([...this.previews.values()].filter((entry) => entry.resultAssetId === resultAssetId));
  }

  public async getLineageByResultId(_resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined> {
    return undefined;
  }
}

class CapturingPersistenceDiagnosticsLogger implements IPersistenceDiagnosticsLogger {
  public readonly infoEvents: PersistenceDiagnosticsLogEvent[] = [];
  public readonly warnEvents: PersistenceDiagnosticsLogEvent[] = [];
  public readonly errorEvents: PersistenceDiagnosticsLogEvent[] = [];

  public info(event: PersistenceDiagnosticsLogEvent): void {
    this.infoEvents.push(event);
  }

  public warn(event: PersistenceDiagnosticsLogEvent): void {
    this.warnEvents.push(event);
  }

  public error(event: PersistenceDiagnosticsLogEvent): void {
    this.errorEvents.push(event);
  }
}

class StubGeneratedResultPreviewGenerationUseCase implements IGenerateGeneratedResultPreviewUseCase {
  public async execute(): Promise<Awaited<ReturnType<IGenerateGeneratedResultPreviewUseCase["execute"]>>> {
    return {
      ok: true,
      value: Object.freeze({
        resultAssetId: "gr-result-authoritative-1",
        workspaceId: "workspace-alpha",
        derivativeId: "preview-display-safe-1",
        previewKind: "display-safe",
        mediaType: "image/webp",
        width: 512,
        height: 512,
        byteSize: 1024,
        protectedResourceId: "protected-resource://gr-preview-000000000000000000000000",
        accessHandle: "preview-access://generated-results/token",
        status: "generated",
      }),
    };
  }
}

describe("SqliteRunCollectedResultPersistenceAdapter", () => {
  it("persists collected outputs as generated result records and returns asset outputs", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const adapter = new SqliteRunCollectedResultPersistenceAdapter({ repository });

    const result = await adapter.persistCollectedResult({
      runId: "run:alpha:001",
      workflowId: "workflow:alpha",
      systemId: "system:alpha",
      workspaceId: "workspace-alpha",
      occurredAt: "2026-04-08T12:10:00.000Z",
      actorId: "node:trusted-1",
      operationKey: "op:result-persist:run-alpha-001",
      collectedResult: Object.freeze({
        schemaVersion: "1.0.0",
        collectionId: "collection:alpha",
        discoveryId: "discovery:alpha",
        executionJobId: "job:alpha",
        runId: "run:alpha:001",
        workspaceId: "workspace-alpha",
        collectedAt: "2026-04-08T12:09:59.000Z",
        status: "collected",
        discoveredOutputs: Object.freeze([
          Object.freeze({
            descriptorId: "descriptor:1",
            discoveredAt: "2026-04-08T12:09:58.000Z",
            outputRole: "primary",
            outputIndex: 0,
            media: Object.freeze({
              mediaKind: "image",
              mimeType: "image/png",
            }),
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:1",
            }),
            sourceInputAssetReference: "input-asset-source-1",
            slotMatch: Object.freeze({
              status: "matched",
              outputId: "output:primary",
            }),
          }),
          Object.freeze({
            descriptorId: "descriptor:2",
            discoveredAt: "2026-04-08T12:09:58.500Z",
            outputRole: "variant",
            outputIndex: 1,
            media: Object.freeze({
              mediaKind: "image",
              mimeType: "image/png",
            }),
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:2",
            }),
          }),
        ]),
        records: Object.freeze([
          Object.freeze({
            descriptorId: "descriptor:1",
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:1",
            }),
            persistence: Object.freeze({
              status: "persisted",
              logicalAsset: Object.freeze({
                assetId: "gr-result-authoritative-1",
                logicalAssetReference: "logical-version-1",
                persistedAt: "2026-04-08T12:09:59.500Z",
              }),
            }),
            lineageMetadata: Object.freeze({
              inputAssetIds: Object.freeze(["input-asset-lineage-1"]),
            }),
          }),
          Object.freeze({
            descriptorId: "descriptor:2",
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:2",
            }),
            persistence: Object.freeze({
              status: "failed",
              errorCode: "store-write-failed",
              message: "Cannot write object.",
              retryable: true,
            }),
          }),
        ]),
        summary: Object.freeze({
          discoveredCount: 2,
          collectedCount: 2,
          persistedCount: 1,
          notPersistedCount: 0,
          failedCount: 1,
        }),
      }),
      terminalResult: Object.freeze({
        summary: "terminal",
      }),
    });

    expect(result.status).toBe("partially-persisted");
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.assetId).toBe("gr-result-authoritative-1");
    expect(result.outputAvailabilityHint).toBe("partial");

    const persistedRecords = [...repository.records.values()];
    expect(persistedRecords).toHaveLength(2);
    expect(persistedRecords.find((entry) => entry.resultAssetId === "gr-result-authoritative-1")?.status)
      .toBe("available");
    expect(persistedRecords.find((entry) => entry.failureCode === "store-write-failed")?.status)
      .toBe("failed-collection");
    expect([...repository.previews.values()].length).toBe(1);
    expect(result.internalDiagnostics).toMatchObject({
      persistedCount: 1,
      failedCount: 1,
      previewPendingCount: 1,
      previewFailedCount: 0,
    });
  });

  it("continues collection when a persisted output cannot be written and records failure state", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const diagnosticsLogger = new CapturingPersistenceDiagnosticsLogger();
    repository.throwOnResultAssetIds.add("gr-result-authoritative-2");
    repository.throwOnResultErrorMessages.set(
      "gr-result-authoritative-2",
      "Temporary storage unavailable for C:\\private\\workspace\\unsafe.db token=abc123",
    );
    const adapter = new SqliteRunCollectedResultPersistenceAdapter({ repository, diagnosticsLogger });

    const result = await adapter.persistCollectedResult({
      runId: "run:beta:001",
      workflowId: "workflow:beta",
      systemId: "system:beta",
      workspaceId: "workspace-beta",
      occurredAt: "2026-04-08T13:00:00.000Z",
      actorId: "node:trusted-2",
      operationKey: "op:result-persist:run-beta-001",
      collectedResult: Object.freeze({
        schemaVersion: "1.0.0",
        collectionId: "collection:beta",
        discoveryId: "discovery:beta",
        executionJobId: "job:beta",
        runId: "run:beta:001",
        workspaceId: "workspace-beta",
        collectedAt: "2026-04-08T12:59:59.000Z",
        status: "collected",
        discoveredOutputs: Object.freeze([
          Object.freeze({
            descriptorId: "descriptor:ok",
            discoveredAt: "2026-04-08T12:59:58.000Z",
            outputRole: "primary",
            outputIndex: 0,
            media: Object.freeze({
              mediaKind: "image",
              mimeType: "image/png",
            }),
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:ok",
            }),
            slotMatch: Object.freeze({
              status: "matched",
              outputId: "output:ok",
            }),
          }),
          Object.freeze({
            descriptorId: "descriptor:failed-write",
            discoveredAt: "2026-04-08T12:59:58.500Z",
            outputRole: "variant",
            outputIndex: 1,
            media: Object.freeze({
              mediaKind: "image",
              mimeType: "image/png",
            }),
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:failed-write",
            }),
            slotMatch: Object.freeze({
              status: "matched",
              outputId: "output:failed-write",
            }),
          }),
        ]),
        records: Object.freeze([
          Object.freeze({
            descriptorId: "descriptor:ok",
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:ok",
            }),
            persistence: Object.freeze({
              status: "persisted",
              logicalAsset: Object.freeze({
                assetId: "gr-result-authoritative-1",
                logicalAssetReference: "logical-version-1",
                persistedAt: "2026-04-08T12:59:59.500Z",
              }),
            }),
          }),
          Object.freeze({
            descriptorId: "descriptor:failed-write",
            temporaryReference: Object.freeze({
              kind: "backend-object-handle",
              backendFamily: "comfyui",
              objectHandle: "output:failed-write",
            }),
            persistence: Object.freeze({
              status: "persisted",
              logicalAsset: Object.freeze({
                assetId: "gr-result-authoritative-2",
                logicalAssetReference: "logical-version-2",
                persistedAt: "2026-04-08T12:59:59.600Z",
              }),
            }),
          }),
        ]),
        summary: Object.freeze({
          discoveredCount: 2,
          collectedCount: 2,
          persistedCount: 2,
          notPersistedCount: 0,
          failedCount: 0,
        }),
      }),
      terminalResult: Object.freeze({
        summary: "terminal",
      }),
    });

    expect(result.status).toBe("partially-persisted");
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]?.assetId).toBe("gr-result-authoritative-1");
    const failed = [...repository.records.values()].find((entry) => entry.resultAssetId === "gr-result-authoritative-2");
    expect(failed?.status).toBe("failed-collection");
    expect(failed?.failureCode).toContain("im.result.operational");
    expect(result.internalDiagnostics).toMatchObject({
      persistedCount: 1,
      failedCount: 1,
      storageUnavailableCount: 1,
    });
    expect(diagnosticsLogger.warnEvents.length).toBeGreaterThan(0);
    const saveFailureEvent = diagnosticsLogger.warnEvents.find((entry) =>
      entry.operation === "persist-collected-result.save-result",
    );
    expect(saveFailureEvent).toBeDefined();
    expect(saveFailureEvent?.slice).toBe("image-manipulation");
    expect(saveFailureEvent?.correlation?.runId).toBe("run:beta:001");
    expect(saveFailureEvent?.correlation?.resultAssetId).toBe("gr-result-authoritative-2");
    expect(saveFailureEvent?.resilience?.[0]?.scope).toBe("result-collection");
    expect(saveFailureEvent?.resilience?.[0]?.retryable).toBeTrue();
    const serialized = JSON.stringify(saveFailureEvent);
    expect(serialized).not.toContain("C:\\\\private\\\\workspace\\\\unsafe.db");
    expect(serialized).not.toContain("abc123");
  });

  it("records preview-failed state when preview provisioning cannot persist", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const diagnosticsLogger = new CapturingPersistenceDiagnosticsLogger();
    repository.remainingPreviewSaveFailures = 1;
    const adapter = new SqliteRunCollectedResultPersistenceAdapter({ repository, diagnosticsLogger });

    const result = await adapter.persistCollectedResult({
      runId: "run:gamma:001",
      workflowId: "workflow:gamma",
      systemId: "system:gamma",
      workspaceId: "workspace-gamma",
      occurredAt: "2026-04-08T14:00:00.000Z",
      actorId: "node:trusted-3",
      operationKey: "op:result-persist:run-gamma-001",
      collectedResult: Object.freeze({
        schemaVersion: "1.0.0",
        collectionId: "collection:gamma",
        discoveryId: "discovery:gamma",
        executionJobId: "job:gamma",
        runId: "run:gamma:001",
        workspaceId: "workspace-gamma",
        collectedAt: "2026-04-08T13:59:59.000Z",
        status: "collected",
        discoveredOutputs: Object.freeze([Object.freeze({
          descriptorId: "descriptor:1",
          discoveredAt: "2026-04-08T13:59:58.000Z",
          outputRole: "primary",
          outputIndex: 0,
          media: Object.freeze({
            mediaKind: "image",
            mimeType: "image/png",
          }),
          temporaryReference: Object.freeze({
            kind: "backend-object-handle",
            backendFamily: "comfyui",
            objectHandle: "output:1",
          }),
          slotMatch: Object.freeze({
            status: "matched",
            outputId: "output:1",
          }),
        })]),
        records: Object.freeze([Object.freeze({
          descriptorId: "descriptor:1",
          temporaryReference: Object.freeze({
            kind: "backend-object-handle",
            backendFamily: "comfyui",
            objectHandle: "output:1",
          }),
          persistence: Object.freeze({
            status: "persisted",
            logicalAsset: Object.freeze({
              assetId: "gr-result-authoritative-1",
              logicalAssetReference: "logical-version-1",
              persistedAt: "2026-04-08T13:59:59.500Z",
            }),
          }),
        })]),
        summary: Object.freeze({
          discoveredCount: 1,
          collectedCount: 1,
          persistedCount: 1,
          notPersistedCount: 0,
          failedCount: 0,
        }),
      }),
      terminalResult: Object.freeze({
        summary: "terminal",
      }),
    });

    expect(result.status).toBe("persisted");
    expect(result.outputs).toHaveLength(1);
    expect(result.internalDiagnostics).toMatchObject({
      previewPendingCount: 0,
      previewFailedCount: 1,
      previewProvisioningUnavailableCount: 0,
    });
    expect([...repository.previews.values()]).toHaveLength(1);
    expect([...repository.previews.values()][0]?.availabilityStatus).toBe("failed");
    const previewFailureEvent = diagnosticsLogger.warnEvents.find((entry) =>
      entry.operation === "persist-collected-result.save-preview",
    );
    expect(previewFailureEvent).toBeDefined();
    expect(previewFailureEvent?.slice).toBe("image-manipulation");
    expect(previewFailureEvent?.correlation?.runId).toBe("run:gamma:001");
    expect(previewFailureEvent?.correlation?.resultAssetId).toBe("gr-result-authoritative-1");
    expect(previewFailureEvent?.correlation?.previewDerivativeId).toBeDefined();
    expect(previewFailureEvent?.resilience?.[0]?.scope).toBe("preview-generation");
  });

  it("uses preview generation use case when configured", async () => {
    const repository = new InMemoryGeneratedResultRepository();
    const adapter = new SqliteRunCollectedResultPersistenceAdapter({
      repository,
      generateGeneratedResultPreviewUseCase: new StubGeneratedResultPreviewGenerationUseCase(),
    });

    const result = await adapter.persistCollectedResult({
      runId: "run:delta:001",
      workflowId: "workflow:delta",
      systemId: "system:delta",
      workspaceId: "workspace-alpha",
      occurredAt: "2026-04-08T15:00:00.000Z",
      actorId: "node:trusted-4",
      operationKey: "op:result-persist:run-delta-001",
      collectedResult: Object.freeze({
        schemaVersion: "1.0.0",
        collectionId: "collection:delta",
        discoveryId: "discovery:delta",
        executionJobId: "job:delta",
        runId: "run:delta:001",
        workspaceId: "workspace-alpha",
        collectedAt: "2026-04-08T14:59:59.000Z",
        status: "collected",
        discoveredOutputs: Object.freeze([Object.freeze({
          descriptorId: "descriptor:1",
          discoveredAt: "2026-04-08T14:59:58.000Z",
          outputRole: "primary",
          outputIndex: 0,
          media: Object.freeze({
            mediaKind: "image",
            mimeType: "image/png",
          }),
          temporaryReference: Object.freeze({
            kind: "backend-object-handle",
            backendFamily: "comfyui",
            objectHandle: "output:1",
          }),
          slotMatch: Object.freeze({
            status: "matched",
            outputId: "output:1",
          }),
        })]),
        records: Object.freeze([Object.freeze({
          descriptorId: "descriptor:1",
          temporaryReference: Object.freeze({
            kind: "backend-object-handle",
            backendFamily: "comfyui",
            objectHandle: "output:1",
          }),
          persistence: Object.freeze({
            status: "persisted",
            logicalAsset: Object.freeze({
              assetId: "gr-result-authoritative-1",
              logicalAssetReference: "storage-instance://storage-default/generated-results/run-delta/output-1.png",
              persistedAt: "2026-04-08T14:59:59.500Z",
            }),
          }),
        })]),
        summary: Object.freeze({
          discoveredCount: 1,
          collectedCount: 1,
          persistedCount: 1,
          notPersistedCount: 0,
          failedCount: 0,
        }),
      }),
      terminalResult: Object.freeze({
        summary: "terminal",
      }),
    });

    expect(result.status).toBe("persisted");
    expect(result.internalDiagnostics).toMatchObject({
      previewGeneratedCount: 1,
      previewPendingCount: 0,
      previewFailedCount: 0,
    });
  });
});
