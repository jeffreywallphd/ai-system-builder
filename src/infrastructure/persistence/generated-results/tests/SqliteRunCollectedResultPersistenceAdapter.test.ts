import { describe, expect, it } from "bun:test";
import type { IGeneratedResultPersistenceRepository } from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import type { GeneratedResultLineageRecord } from "@application/generated-results/ports/IGeneratedResultPersistenceRepository";
import type {
  GeneratedResultPersistenceMutationEnvelope,
  GeneratedResultPersistenceMutationResult,
  GeneratedResultPersistenceRecord,
  GeneratedResultPreviewPersistenceRecord,
} from "@shared/dto/assets/GeneratedResultPersistenceDtos";
import { SqliteRunCollectedResultPersistenceAdapter } from "../SqliteRunCollectedResultPersistenceAdapter";

class InMemoryGeneratedResultRepository implements IGeneratedResultPersistenceRepository {
  public readonly records = new Map<string, GeneratedResultPersistenceRecord>();

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
    const changed = JSON.stringify(this.records.get(record.resultAssetId)) !== JSON.stringify(record);
    this.records.set(record.resultAssetId, record);
    return Object.freeze({ record, changed, wasReplay: false });
  }

  public async savePreview(
    record: GeneratedResultPreviewPersistenceRecord,
    _mutation: GeneratedResultPersistenceMutationEnvelope,
  ): Promise<GeneratedResultPersistenceMutationResult<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze({ record, changed: true, wasReplay: false });
  }

  public async listPreviewsByResultId(
    _resultAssetId: string,
  ): Promise<ReadonlyArray<GeneratedResultPreviewPersistenceRecord>> {
    return Object.freeze([]);
  }

  public async getLineageByResultId(_resultAssetId: string): Promise<GeneratedResultLineageRecord | undefined> {
    return undefined;
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
  });
});
