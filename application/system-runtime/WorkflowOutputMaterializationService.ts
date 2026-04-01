import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { ImageAssetReferenceInput } from "../../domain/dataset-studio/contracts/ImageAssetReference";
import type {
  DatasetInstanceImageGeneration,
  DatasetInstanceImageRecord,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { SystemDatasetInstanceService } from "./SystemDatasetInstanceService";
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
  ) {}

  public async materialize(
    request: MaterializeWorkflowOutputsRequest,
  ): Promise<MaterializeWorkflowOutputsResult> {
    const payload = validateWorkflowOutputMaterializationPayload(request.payload);
    const records: DatasetInstanceImageRecord[] = [];

    for (let assetIndex = 0; assetIndex < payload.producedAssets.length; assetIndex += 1) {
      const producedAsset = payload.producedAssets[assetIndex]!;
      const generation = materializationAssetToDatasetGeneration({ payload, assetIndex });
      const image = this.buildImageRecordShape({ payload, assetIndex, generation });
      const metadata = this.readMetadataRecord(producedAsset.metadata);

      const persisted = await this.datasetInstances.ingestImageRecordIntoInstance({
        systemId: request.systemId,
        instanceId: request.datasetInstanceId,
        record: image,
        storageReference: this.resolveStorageReference(producedAsset.assetRef),
        storageProvider: producedAsset.assetRef.kind ?? "generated-output",
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
            metadataPatch: {
              replace: generation.metadata,
            },
            tags: generation.tags,
          },
        },
      });

      records.push(withGeneration);
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
      assetRef: producedAsset.assetRef as ImageAssetReferenceInput,
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
