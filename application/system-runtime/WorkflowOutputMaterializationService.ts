import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { ImageAssetReferenceInput } from "../../domain/dataset-studio/contracts/ImageAssetReference";
import type {
  DatasetInstanceImageGeneration,
  DatasetInstanceImageRecord,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { DatasetInstance } from "../../domain/system-runtime/DatasetInstanceDomain";
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
  readonly failures: ReadonlyArray<{
    readonly assetIndex: number;
    readonly code: "artifact-persist-failed" | "dataset-write-failed" | "invalid-request";
    readonly message: string;
    readonly retriable: boolean;
  }>;
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
    const datasetInstance = this.datasetInstances.loadDatasetInstance({
      systemId: request.systemId,
      instanceId: request.datasetInstanceId,
    });
    const records: DatasetInstanceImageRecord[] = [];
    const failures: MaterializeWorkflowOutputsResult["failures"] = [];

    if (payload.producedAssets.length === 0) {
      const status = payload.status === "failed" ? "failed" : "partial";
      return Object.freeze({
        materializationId: payload.materializationId,
        datasetInstanceId: request.datasetInstanceId,
        status,
        records: Object.freeze(records),
        failures: Object.freeze(failures),
      });
    }

    for (let assetIndex = 0; assetIndex < payload.producedAssets.length; assetIndex += 1) {
      const producedAsset = payload.producedAssets[assetIndex]!;
      const generation = materializationAssetToDatasetGeneration({ payload, assetIndex });
      try {
        const persistedArtifact = await this.persistArtifactIfPresent({
          payload,
          assetIndex,
          systemId: request.systemId,
          datasetInstanceId: request.datasetInstanceId,
          datasetStorageBinding: datasetInstance.storageBinding,
        });
        const image = this.buildImageRecordShape({ payload, assetIndex, generation, persistedArtifact });
        const metadata = this.readMetadataRecord({
          ...producedAsset.metadata,
          ...(persistedArtifact?.metadata ?? {}),
        });
        const deterministicRecordId = this.createMaterializationRecordId(payload, assetIndex);
        const existing = this.datasetInstances.getImageRecordFromInstance({
          systemId: request.systemId,
          instanceId: request.datasetInstanceId,
          recordId: deterministicRecordId,
        });

        const persisted = existing
          ? await this.datasetInstances.updateImageRecordInInstance({
            systemId: request.systemId,
            instanceId: request.datasetInstanceId,
            recordId: deterministicRecordId,
            patch: {
              imagePatch: {
                assetRef: image.assetRef as ImageAssetReferenceInput,
                width: image.width as number,
                height: image.height as number,
                format: image.format as string,
                mimeType: (image.mimeType as string | undefined) ?? null,
                metadataPatch: {
                  replace: this.readMetadataRecord((image.metadata as Readonly<Record<string, CanonicalRecordValue>>) ?? {}),
                },
                tags: Object.freeze([...(image.tags as ReadonlyArray<string> ?? [])]),
              },
              storagePatch: {
                reference: persistedArtifact?.storageReference
                  ?? this.resolveStorageReference(producedAsset.assetRef)
                  ?? this.resolveStorageReferenceFromBinding({
                    bindingReference: datasetInstance.storageBinding?.bindingReference,
                    workflowRunId: payload.workflowRun.runId,
                    materializationId: payload.materializationId,
                    assetIndex,
                  })
                  ?? null,
                provider: persistedArtifact?.storageProvider ?? producedAsset.assetRef.kind ?? "generated-output",
              },
              metadataPatch: {
                replace: metadata,
              },
              provenancePatch: {
                sourceType: "workflow-output-materialized",
                sourceReference: `${payload.materializationId}:${assetIndex}`,
                sourceRunId: payload.workflowRun.runId,
              },
            },
          })
          : await this.datasetInstances.ingestImageRecordIntoInstance({
            systemId: request.systemId,
            instanceId: request.datasetInstanceId,
            recordId: deterministicRecordId,
            record: image,
            storageReference: persistedArtifact?.storageReference
              ?? this.resolveStorageReference(producedAsset.assetRef)
              ?? this.resolveStorageReferenceFromBinding({
                bindingReference: datasetInstance.storageBinding?.bindingReference,
                workflowRunId: payload.workflowRun.runId,
                materializationId: payload.materializationId,
                assetIndex,
              }),
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown materialization error";
        failures.push(Object.freeze({
          assetIndex,
          code: message.includes("invalid-request")
            ? "invalid-request"
            : (message.includes("artifact-persist-failed") ? "artifact-persist-failed" : "dataset-write-failed"),
          message,
          retriable: !message.includes("invalid-request"),
        }));
      }
    }

    const status = this.resolveFinalStatus({
      requestedStatus: payload.status,
      recordCount: records.length,
      failureCount: failures.length,
    });

    return Object.freeze({
      materializationId: payload.materializationId,
      datasetInstanceId: request.datasetInstanceId,
      status,
      records: Object.freeze(records),
      failures: Object.freeze(failures),
    });
  }
  private createMaterializationRecordId(
    payload: WorkflowOutputMaterializationPayload,
    assetIndex: number,
  ): string {
    return `matrec:${payload.materializationId}:${assetIndex}`;
  }

  private resolveFinalStatus(input: {
    readonly requestedStatus: WorkflowOutputMaterializationPayload["status"];
    readonly recordCount: number;
    readonly failureCount: number;
  }): WorkflowOutputMaterializationPayload["status"] {
    if (input.recordCount > 0 && input.failureCount === 0) {
      return "materialized";
    }
    if (input.recordCount > 0 && input.failureCount > 0) {
      return "partial";
    }
    if (input.requestedStatus === "pending") {
      return "pending";
    }
    return "failed";
  }

  private buildImageRecordShape(input: {
    readonly payload: WorkflowOutputMaterializationPayload;
    readonly assetIndex: number;
    readonly generation: DatasetInstanceImageGeneration;
    readonly persistedArtifact?: Awaited<ReturnType<WorkflowOutputMaterializationService["persistArtifactIfPresent"]>>;
  }): Readonly<Record<string, unknown>> {
    const producedAsset = input.payload.producedAssets[input.assetIndex]!;
    const metadata = producedAsset.metadata;

    const width = this.requirePositiveNumber(
      metadata.width,
      `Produced image #${input.assetIndex + 1} is missing width.`,
    );
    const height = this.requirePositiveNumber(
      metadata.height,
      `Produced image #${input.assetIndex + 1} is missing height.`,
    );
    const mimeType = this.readOptionalString(metadata.mimeType);
    const format = this.requireFormat({
      format: this.readOptionalString(metadata.format),
      mimeType,
      fallbackMessage: `Produced image #${input.assetIndex + 1} is missing format details.`,
    });

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
    readonly datasetStorageBinding?: DatasetInstance["storageBinding"];
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
    try {
      return await this.artifactStorage.persist({
        systemId: input.systemId,
        datasetInstanceId: input.datasetInstanceId,
        datasetStorageBinding: this.resolveStorageBinding(input.datasetStorageBinding),
        workflowRunId: input.payload.workflowRun.runId,
        materializationId: input.payload.materializationId,
        assetIndex: input.assetIndex,
        role: produced.role,
        payload: new Uint8Array(decoded),
        fileNameHint: binaryPayload.fileNameHint,
        extensionHint: binaryPayload.extensionHint,
        mimeTypeHint: binaryPayload.mimeTypeHint,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to persist artifact";
      throw new Error(`artifact-persist-failed:${message}`);
    }
  }

  private resolveStorageBinding(
    binding: DatasetInstance["storageBinding"] | undefined,
  ): NonNullable<DatasetInstance["storageBinding"]> {
    if (!binding) {
      throw new Error("artifact-persist-failed:Dataset instance is missing a storage binding.");
    }
    return binding;
  }

  private resolveStorageReferenceFromBinding(input: {
    readonly bindingReference?: string;
    readonly workflowRunId: string;
    readonly materializationId: string;
    readonly assetIndex: number;
  }): string | undefined {
    const bindingReference = input.bindingReference?.trim();
    if (!bindingReference) {
      return undefined;
    }
    return `${bindingReference}/runs/${encodeURIComponent(input.workflowRunId)}/${encodeURIComponent(input.materializationId)}/${input.assetIndex}`;
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
    return [assetRef.outputId, assetRef.stableId, assetRef.assetId, assetRef.uri, assetRef.path]
      .find((value): value is string => this.isLogicalStorageReference(value));
  }

  private isLogicalStorageReference(value: unknown): value is string {
    if (typeof value !== "string") {
      return false;
    }
    const normalized = value.trim();
    if (!normalized) {
      return false;
    }
    const lower = normalized.toLowerCase();
    if (lower.startsWith("storage-instance://")) {
      return true;
    }
    if (lower.startsWith("dataset-instance://")) {
      return true;
    }
    if (lower.startsWith("generated-output:storage-instance://")) {
      return true;
    }
    if (lower.startsWith("asset:")) {
      return true;
    }
    if (lower.startsWith("memory://") || lower.startsWith("file://")) {
      return false;
    }
    if (/^[a-z]:[\\/]/i.test(normalized) || normalized.startsWith("\\\\")) {
      return false;
    }
    return false;
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

  private requirePositiveNumber(value: unknown, message: string): number {
    const parsed = this.readPositiveNumber(value);
    if (parsed === undefined) {
      throw new Error(`invalid-request:${message}`);
    }
    return parsed;
  }

  private requireFormat(input: {
    readonly format?: string;
    readonly mimeType?: string;
    readonly fallbackMessage: string;
  }): string {
    const resolved = input.format ?? this.formatFromMimeType(input.mimeType);
    if (!resolved) {
      throw new Error(`invalid-request:${input.fallbackMessage}`);
    }
    return resolved;
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
