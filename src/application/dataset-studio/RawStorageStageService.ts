import { createHash } from "node:crypto";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  createIngestionLineageHook,
  createIngestionLogRecord,
  IngestionExecutionModes,
  IngestionExecutionStatuses,
  type IngestionLineageHook,
  type IngestionLogRecord,
} from "./IngestionContracts";
import {
  createRawStorageStageOutput,
  toStageRecordFromRawStorageOutput,
  type RawStorageStageOutput,
} from "./StageIntegrationContracts";

export const RawStorageStageAssetId = "raw-storage-stage";
export const RawStorageStageAssetVersion = "1.0.0";

export interface RawStoragePersistRequest {
  readonly source: {
    readonly sourceId?: string;
    readonly sourceReference?: string;
    readonly referenceKind?: string;
    readonly sourceAssetId?: string;
    readonly sourceVersionId?: string;
  };
  readonly rawPayload?: string | Uint8Array;
  readonly storageReferenceHint?: string;
  readonly contentType?: string;
  readonly traceability?: {
    readonly lineageId?: string;
    readonly pipelineId?: string;
    readonly upstreamStageId?: string;
    readonly executionId?: string;
    readonly runId?: string;
  };
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface RawStoragePersistenceResult {
  readonly storageReference: string;
  readonly persistedAt: string;
  readonly byteLength?: number;
  readonly contentDigest?: string;
}

export interface IRawStoragePersistenceAdapter {
  persist(request: RawStoragePersistRequest): Promise<RawStoragePersistenceResult>;
}

export interface RawStorageStageExecutionResult {
  readonly output: RawStorageStageOutput;
  readonly stageRecord: Readonly<Record<string, CanonicalRecordValue>>;
  readonly lineage: IngestionLineageHook;
  readonly log: IngestionLogRecord;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toByteLength(payload?: string | Uint8Array): number | undefined {
  if (payload === undefined) {
    return undefined;
  }
  if (typeof payload === "string") {
    return Buffer.byteLength(payload, "utf-8");
  }
  return payload.byteLength;
}

function toDigest(payload?: string | Uint8Array): string | undefined {
  if (payload === undefined) {
    return undefined;
  }
  const hash = createHash("sha256");
  if (typeof payload === "string") {
    hash.update(payload, "utf-8");
  } else {
    hash.update(payload);
  }
  return hash.digest("hex");
}

export class DefaultRawStoragePersistenceAdapter implements IRawStoragePersistenceAdapter {
  public async persist(request: RawStoragePersistRequest): Promise<RawStoragePersistenceResult> {
    const persistedAt = nowIso();
    const sourceKey = request.source.sourceId ?? "source";
    const storageReference = request.storageReferenceHint?.trim()
      || `raw://dataset-studio/${sourceKey}/${Date.now().toString(36)}`;

    return Object.freeze({
      storageReference,
      persistedAt,
      byteLength: toByteLength(request.rawPayload),
      contentDigest: toDigest(request.rawPayload),
    });
  }
}

export class RawStorageStageService {
  private readonly adapter: IRawStoragePersistenceAdapter;

  constructor(adapter: IRawStoragePersistenceAdapter = new DefaultRawStoragePersistenceAdapter()) {
    this.adapter = adapter;
  }

  public async persist(request: RawStoragePersistRequest): Promise<RawStorageStageExecutionResult> {
    const persisted = await this.adapter.persist(request);
    const output = createRawStorageStageOutput({
      source: request.source,
      persistence: {
        storageReference: persisted.storageReference,
        persistedAt: persisted.persistedAt,
        byteLength: persisted.byteLength,
        contentDigest: persisted.contentDigest,
        persistedContentType: request.contentType,
      },
      traceability: {
        lineageId: request.traceability?.lineageId,
        pipelineId: request.traceability?.pipelineId,
        upstreamStageId: request.traceability?.upstreamStageId,
        notes: Object.freeze([
          "Raw storage metadata is persisted through a bounded adapter seam.",
        ]),
      },
    });

    const lineage = createIngestionLineageHook({
      producer: Object.freeze({
        assetId: RawStorageStageAssetId,
        assetVersion: RawStorageStageAssetVersion,
      }),
      executionMode: IngestionExecutionModes.execute,
      executionId: request.traceability?.executionId,
      runId: request.traceability?.runId,
      sources: Object.freeze([
        Object.freeze({
          sourceId: request.source.sourceId,
          sourceReference: request.source.sourceReference,
          sourceType: request.source.referenceKind,
        }),
      ]),
      output: Object.freeze({
        shapeKind: "raw-storage-reference",
        totalCount: 1,
      }),
      configSummary: request.metadata as Readonly<Record<string, unknown>> | undefined,
    });

    const log = createIngestionLogRecord({
      executionMode: IngestionExecutionModes.execute,
      status: IngestionExecutionStatuses.succeeded,
      asset: Object.freeze({
        assetId: RawStorageStageAssetId,
        assetVersion: RawStorageStageAssetVersion,
      }),
      executionId: request.traceability?.executionId,
      runId: request.traceability?.runId,
      sources: lineage.sources,
      outputSummary: lineage.output,
      lineage,
      configSummary: request.metadata as Readonly<Record<string, unknown>> | undefined,
      completedAt: output.persistence.persistedAt,
    });

    return Object.freeze({
      output,
      stageRecord: toStageRecordFromRawStorageOutput(output),
      lineage,
      log,
    });
  }
}
