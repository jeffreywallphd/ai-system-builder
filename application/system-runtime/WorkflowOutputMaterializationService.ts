import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { ImageAssetReferenceInput } from "../../domain/dataset-studio/contracts/ImageAssetReference";
import type {
  DatasetInstanceImageGeneration,
  DatasetInstanceImageRecord,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { SystemDatasetInstanceService } from "./SystemDatasetInstanceService";
import type { WorkflowOutputArtifactStorage } from "./WorkflowOutputArtifactStorage";
import type { WorkflowOutputProvenanceRepository } from "./WorkflowOutputProvenanceRepository";
import {
  materializationAssetToDatasetGeneration,
  validateWorkflowOutputMaterializationPayload,
  type WorkflowOutputMaterializationPayload,
} from "./WorkflowOutputMaterializationContract";

export interface MaterializeWorkflowOutputsRequest {
  readonly systemId: string;
  readonly datasetInstanceId: string;
  readonly payload: WorkflowOutputMaterializationPayload;
}

export interface MaterializeWorkflowOutputsResult {
  readonly materializationId: string;
  readonly datasetInstanceId: string;
  readonly status: WorkflowOutputMaterializationPayload["status"];
  readonly records: ReadonlyArray<DatasetInstanceImageRecord>;
}

export class WorkflowOutputMaterializationService {
  public constructor(
    private readonly datasetInstances: SystemDatasetInstanceService,
    private readonly artifactStorage?: WorkflowOutputArtifactStorage,
    private readonly provenanceRepository?: WorkflowOutputProvenanceRepository,
  ) {}

  public async materialize(
    request: MaterializeWorkflowOutputsRequest,
  ): Promise<MaterializeWorkflowOutputsResult> {
    const payload = validateWorkflowOutputMaterializationPayload(request.payload);
    const records: DatasetInstanceImageRecord[] = [];

    for (let assetIndex = 0; assetIndex < payload.producedAssets.length; assetIndex += 1) {
      const producedAsset = payload.producedAssets[assetIndex]!;
      const generation = materializationAssetToDatasetGeneration({ payload, assetIndex });
      const persistedArtifact = await this.persistArtifactIfPresent({
        payload,
        assetIndex,
        systemId: request.systemId,
        datasetInstanceId: request.datasetInstanceId,
      });
      const image = this.buildImageRecordShape({ payload, assetIndex, generation, persistedArtifact });
      const metadata = this.readMetadataRecord({
        ...producedAsset.metadata,
        ...(persistedArtifact?.metadata ?? {}),
      });

      const persisted = await this.datasetInstances.ingestImageRecordIntoInstance({
        systemId: request.systemId,
        instanceId: request.datasetInstanceId,
        record: image,
        storageReference: persistedArtifact?.storageReference ?? this.resolveStorageReference(producedAsset.assetRef),
        storageProvider: persistedArtifact?.storageProvider ?? producedAsset.assetRef.kind ?? "generated-output",
        metadata,
        provenance: this.createProvenance(payload, assetIndex),
        lineageContext: {
          workflowAssetId: payload.workflowRun.workflowAssetId,
          workflowExecutionId: payload.workflowRun.runId,
          actorId: request.systemId,
          source: "workflow-output-materialization-service",
        },
      });
      const withGeneration = await this.datasetInstances.updateImageRecordInInstance({
        systemId: request.systemId,
        instanceId: request.datasetInstanceId,
        recordId: persisted.recordId,
        patch: {
          generationPatch: {
            outputAssetRef: generation.outputAssetRef,
            sourceImageRef: generation.sourceImageRef ?? null,
            workflowAssetId: generation.workflowAssetId,
            workflowAssetVersionId: generation.workflowAssetVersionId ?? null,
            runId: generation.runId,
            role: generation.role,
            outputIndex: generation.outputIndex ?? null,
            outputGroupId: generation.outputGroupId ?? null,
            metadataPatch: {
              replace: generation.metadata,
            },
            tags: generation.tags,
          },
        },
      });

      records.push(withGeneration);
      this.persistProvenanceRecord({
        payload,
        assetIndex,
        systemId: request.systemId,
        datasetInstanceId: request.datasetInstanceId,
        recordId: withGeneration.recordId,
        outputAssetStableId: withGeneration.image.assetRef.stableId,
      });
    }

    return Object.freeze({
      materializationId: payload.materializationId,
      datasetInstanceId: request.datasetInstanceId,
      status: payload.status,
      records: Object.freeze(records),
    });
  }

  private buildImageRecordShape(input: {
    readonly payload: WorkflowOutputMaterializationPayload;
    readonly assetIndex: number;
    readonly generation: DatasetInstanceImageGeneration;
    readonly persistedArtifact?: Awaited<ReturnType<WorkflowOutputMaterializationService["persistArtifactIfPresent"]>>;
  }): Readonly<Record<string, unknown>> {
    const producedAsset = input.payload.producedAssets[input.assetIndex]!;
    const metadata = producedAsset.metadata;

    const width = this.readPositiveNumber(metadata.width) ?? 1;
    const height = this.readPositiveNumber(metadata.height) ?? 1;
    const mimeType = this.readOptionalString(metadata.mimeType);
    const format = this.readOptionalString(metadata.format)
      ?? this.formatFromMimeType(mimeType)
      ?? "png";

    return Object.freeze({
      assetRef: (input.persistedArtifact?.assetRef ?? producedAsset.assetRef) as ImageAssetReferenceInput,
      width,
      height,
      format,
      mimeType,
      metadata: Object.freeze({
        ...metadata,
        materializationId: input.payload.materializationId,
        workflowRunId: input.payload.workflowRun.runId,
        outputRole: input.generation.role,
      }),
      tags: Object.freeze([...(producedAsset.tags ?? [])]),
      generation: input.generation,
    });
  }


  private async persistArtifactIfPresent(input: {
    readonly payload: WorkflowOutputMaterializationPayload;
    readonly assetIndex: number;
    readonly systemId: string;
    readonly datasetInstanceId: string;
  }) {
    if (!this.artifactStorage) {
      return undefined;
    }
    const produced = input.payload.producedAssets[input.assetIndex];
    const binaryPayload = produced?.binaryPayload;
    if (!produced || !binaryPayload) {
      return undefined;
    }

    const decoded = Buffer.from(binaryPayload.dataBase64, "base64");
    if (decoded.length === 0) {
      throw new Error(`invalid-request:Produced asset '${input.assetIndex}' included an empty binary payload.`);
    }

    return this.artifactStorage.persist({
      systemId: input.systemId,
      datasetInstanceId: input.datasetInstanceId,
      workflowRunId: input.payload.workflowRun.runId,
      materializationId: input.payload.materializationId,
      assetIndex: input.assetIndex,
      role: produced.role,
      payload: new Uint8Array(decoded),
      fileNameHint: binaryPayload.fileNameHint,
      extensionHint: binaryPayload.extensionHint,
      mimeTypeHint: binaryPayload.mimeTypeHint,
    });
  }

  private persistProvenanceRecord(input: {
    readonly payload: WorkflowOutputMaterializationPayload;
    readonly assetIndex: number;
    readonly systemId: string;
    readonly datasetInstanceId: string;
    readonly recordId: string;
    readonly outputAssetStableId: string;
  }): void {
    if (!this.provenanceRepository) {
      return;
    }
    const produced = input.payload.producedAssets[input.assetIndex];
    if (!produced) {
      return;
    }

    const sourceImageStableIds = [
      produced.sourceImageRef?.stableId,
      input.payload.sourceImage?.imageRef.stableId,
      ...(input.payload.sourceImages ?? []).map((entry) => entry.imageRef.stableId),
    ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

    const nowIso = new Date().toISOString();
    this.provenanceRepository.save(Object.freeze({
      provenanceId: `${input.payload.materializationId}:${input.assetIndex}:${input.recordId}`,
      createdAt: nowIso,
      updatedAt: nowIso,
      status: input.payload.status,
      systemId: input.systemId,
      datasetInstanceId: input.datasetInstanceId,
      materializationId: input.payload.materializationId,
      workflowRunId: input.payload.workflowRun.runId,
      workflowAssetId: input.payload.workflowRun.workflowAssetId,
      workflowAssetVersionId: input.payload.workflowRun.workflowAssetVersionId,
      outputRecordId: input.recordId,
      outputAssetStableId: input.outputAssetStableId,
      outputRole: produced.role,
      outputIndex: produced.outputIndex ?? input.assetIndex,
      outputGroupId: produced.outputGroupId ?? `run:${input.payload.workflowRun.runId}`,
      sourceImageStableIds: Object.freeze([...new Set(sourceImageStableIds)]),
      parameterSnapshot: Object.freeze({ ...input.payload.parameterSnapshot }),
      executionContext: Object.freeze({ ...input.payload.executionContext.configurationSnapshot }),
      capabilityContext: Object.freeze({ ...input.payload.executionContext.capabilityProfile }),
    }));
  }

  private createProvenance(payload: WorkflowOutputMaterializationPayload, assetIndex: number) {
    return Object.freeze({
      sourceType: "workflow-output-materialized",
      sourceReference: `${payload.materializationId}:${assetIndex}`,
      sourceRunId: payload.workflowRun.runId,
    });
  }

  private resolveStorageReference(assetRef: WorkflowOutputMaterializationPayload["producedAssets"][number]["assetRef"]): string | undefined {
    return [assetRef.path, assetRef.uri, assetRef.outputId, assetRef.stableId, assetRef.assetId]
      .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  }

  private readMetadataRecord(metadata: Readonly<Record<string, CanonicalRecordValue>>): Readonly<Record<string, CanonicalRecordValue>> {
    return Object.freeze({
      ...metadata,
    });
  }

  private readPositiveNumber(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return value;
  }

  private readOptionalString(value: unknown): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private formatFromMimeType(mimeType?: string): string | undefined {
    const normalized = this.readOptionalString(mimeType)?.toLowerCase();
    if (!normalized || !normalized.includes("/")) {
      return undefined;
    }
    return normalized.split("/")[1]?.trim() || undefined;
  }
}
