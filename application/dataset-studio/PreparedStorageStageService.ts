import { createHash } from "node:crypto";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DataLineageReferenceKinds,
  createDataLineageExecutionStep,
  createDataLineageMetadata,
  createDataLineageReference,
  type DataLineageMetadata,
} from "../../domain/dataset-studio/DataLineageMetadata";
import {
  createPreparedStorageStageOutput,
  toStageRecordFromPreparedStorageOutput,
  type PreparedStorageStageOutput,
} from "./StageIntegrationContracts";

export const PreparedStorageStageAssetId = "prepared-storage-stage";
export const PreparedStorageStageAssetVersion = "1.0.0";

export interface PreparedStoragePersistRequest {
  readonly preparedDataset: {
    readonly preparedAssetId: string;
    readonly preparedAssetVersionId: string;
    readonly outputShapeKind: CanonicalDataShapeKind;
    readonly recordCount?: number;
    readonly byteLength?: number;
  };
  readonly storageTarget: {
    readonly targetId: string;
    readonly destinationReference?: string;
  };
  readonly pipeline: {
    readonly pipelineAssetId: string;
    readonly pipelineVersionId?: string;
    readonly pipelineDraftId?: string;
  };
  readonly upstream: {
    readonly upstreamAssetIds: ReadonlyArray<string>;
    readonly upstreamPipelineAssetIds: ReadonlyArray<string>;
    readonly upstreamSourceReferences?: ReadonlyArray<string>;
  };
  readonly stageLineage?: ReadonlyArray<{
    readonly stageId: string;
    readonly order: number;
    readonly status?: "current" | "completed" | "skipped" | "pending" | "disabled";
  }>;
  readonly preparationContext?: {
    readonly authoringMode?: "wizard" | "canvas";
    readonly presentationMode?: "simple" | "advanced";
    readonly currentStageId?: string;
  };
  readonly reuse?: {
    readonly reusableAsAsset: boolean;
    readonly reusableLabel?: string;
  };
  readonly traceability?: {
    readonly lineageId?: string;
    readonly executionId?: string;
    readonly requestId?: string;
    readonly operationId?: string;
  };
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface PreparedStoragePersistenceResult {
  readonly storageReference: string;
  readonly persistedAt: string;
  readonly contentDigest?: string;
}

export interface IPreparedStoragePersistenceAdapter {
  persist(request: PreparedStoragePersistRequest): Promise<PreparedStoragePersistenceResult>;
}

export interface PreparedStorageStageExecutionResult {
  readonly output: PreparedStorageStageOutput;
  readonly stageRecord: Readonly<Record<string, CanonicalRecordValue>>;
  readonly lineage: DataLineageMetadata;
}

function normalizeId(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function dedupe(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]);
}

function nowIso(): string {
  return new Date().toISOString();
}

function digestFromRequest(request: PreparedStoragePersistRequest): string {
  const hash = createHash("sha256");
  hash.update(request.preparedDataset.preparedAssetId, "utf-8");
  hash.update(request.preparedDataset.preparedAssetVersionId, "utf-8");
  hash.update(request.pipeline.pipelineAssetId, "utf-8");
  hash.update(JSON.stringify(request.metadata ?? {}), "utf-8");
  return hash.digest("hex");
}

function defaultLineageId(request: PreparedStoragePersistRequest): string {
  if (request.traceability?.lineageId?.trim()) {
    return request.traceability.lineageId.trim();
  }
  return `lineage:${request.preparedDataset.preparedAssetId}:${Date.now().toString(36)}`;
}

export class DefaultPreparedStoragePersistenceAdapter implements IPreparedStoragePersistenceAdapter {
  public async persist(request: PreparedStoragePersistRequest): Promise<PreparedStoragePersistenceResult> {
    const persistedAt = nowIso();
    const storageReference = request.storageTarget.destinationReference?.trim()
      || `prepared://dataset-studio/${request.preparedDataset.preparedAssetId}/${request.preparedDataset.preparedAssetVersionId}`;
    return Object.freeze({
      storageReference,
      persistedAt,
      contentDigest: digestFromRequest(request),
    });
  }
}

export class PreparedStorageStageService {
  private readonly adapter: IPreparedStoragePersistenceAdapter;

  constructor(adapter: IPreparedStoragePersistenceAdapter = new DefaultPreparedStoragePersistenceAdapter()) {
    this.adapter = adapter;
  }

  public async persistPreparedDataset(
    request: PreparedStoragePersistRequest,
  ): Promise<PreparedStorageStageExecutionResult> {
    const preparedAssetId = normalizeId(request.preparedDataset.preparedAssetId, "preparedDataset.preparedAssetId");
    const preparedAssetVersionId = normalizeId(
      request.preparedDataset.preparedAssetVersionId,
      "preparedDataset.preparedAssetVersionId",
    );
    const targetId = normalizeId(request.storageTarget.targetId, "storageTarget.targetId");
    const pipelineAssetId = normalizeId(request.pipeline.pipelineAssetId, "pipeline.pipelineAssetId");

    const upstreamAssetIds = dedupe(request.upstream.upstreamAssetIds);
    const upstreamPipelineAssetIds = dedupe(request.upstream.upstreamPipelineAssetIds);
    if (upstreamAssetIds.length === 0 && upstreamPipelineAssetIds.length === 0) {
      throw new Error("Prepared storage persistence requires at least one upstream asset or upstream pipeline reference.");
    }

    const persisted = await this.adapter.persist(request);
    const lineageId = defaultLineageId(request);
    const output = createPreparedStorageStageOutput({
      dataset: {
        preparedAssetId,
        preparedAssetVersionId,
        outputShapeKind: request.preparedDataset.outputShapeKind,
        recordCount: request.preparedDataset.recordCount,
        byteLength: request.preparedDataset.byteLength,
      },
      persistence: {
        targetId,
        storageReference: persisted.storageReference,
        persistedAt: persisted.persistedAt,
        contentDigest: persisted.contentDigest,
      },
      lineage: {
        lineageId,
        pipelineAssetId,
        pipelineVersionId: request.pipeline.pipelineVersionId,
        upstreamAssetIds,
        upstreamPipelineAssetIds,
        upstreamSourceReferences: dedupe(request.upstream.upstreamSourceReferences ?? []),
        stageStructure: Object.freeze((request.stageLineage ?? []).map((entry) => Object.freeze({
          stageId: entry.stageId.trim(),
          order: entry.order,
          status: entry.status,
        }))),
        preparationContext: request.preparationContext
          ? Object.freeze({
            authoringMode: request.preparationContext.authoringMode,
            presentationMode: request.preparationContext.presentationMode,
            currentStageId: request.preparationContext.currentStageId?.trim() || undefined,
          })
          : undefined,
        reuse: request.reuse
          ? Object.freeze({
            reusableAsAsset: request.reuse.reusableAsAsset,
            reusableLabel: request.reuse.reusableLabel?.trim() || undefined,
          })
          : undefined,
      },
    });

    const lineageInputs = [
      ...upstreamAssetIds.map((assetId, index) => createDataLineageReference({
        referenceId: `input-asset-${index + 1}`,
        kind: DataLineageReferenceKinds.asset,
        assetId,
      })),
      ...upstreamPipelineAssetIds.map((assetId, index) => createDataLineageReference({
        referenceId: `input-pipeline-${index + 1}`,
        kind: DataLineageReferenceKinds.asset,
        assetId,
      })),
    ];
    const lineageOutput = createDataLineageReference({
      referenceId: "prepared-output-1",
      kind: DataLineageReferenceKinds.asset,
      assetId: preparedAssetId,
      versionId: preparedAssetVersionId,
      shapeKind: request.preparedDataset.outputShapeKind,
      attributes: Object.freeze({
        storageReference: persisted.storageReference,
        targetId,
      }),
    });

    const startedAt = request.traceability?.operationId ? nowIso() : persisted.persistedAt;
    const lineage = createDataLineageMetadata({
      capturedAt: persisted.persistedAt,
      producer: Object.freeze({
        assetId: PreparedStorageStageAssetId,
        versionId: PreparedStorageStageAssetVersion,
        name: "Prepared Storage Stage",
      }),
      execution: Object.freeze({
        executionId: request.traceability?.executionId?.trim() || `exec:${lineageId}`,
        requestId: request.traceability?.requestId,
        operationId: request.traceability?.operationId,
        pipelineId: pipelineAssetId,
        stageId: "StoragePrepared",
        startedAt,
        completedAt: persisted.persistedAt,
      }),
      inputs: Object.freeze(lineageInputs),
      steps: Object.freeze([
        createDataLineageExecutionStep({
          stepId: "persist-prepared-dataset",
          kind: "package-result",
          status: "completed",
          startedAt,
          completedAt: persisted.persistedAt,
          inputReferenceIds: lineageInputs.map((entry) => entry.referenceId),
          outputReferenceIds: Object.freeze([lineageOutput.referenceId]),
          notes: Object.freeze([
            "Prepared dataset registered with storage target and upstream lineage linkage.",
          ]),
        }),
      ]),
      outputs: Object.freeze([lineageOutput]),
      attributes: Object.freeze({
        lineageId,
        pipelineDraftId: request.pipeline.pipelineDraftId,
      }),
    });

    return Object.freeze({
      output,
      stageRecord: toStageRecordFromPreparedStorageOutput(output),
      lineage,
    });
  }
}
