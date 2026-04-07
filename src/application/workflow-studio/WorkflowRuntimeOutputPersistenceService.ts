import type { IAsset } from "@domain/assets/interfaces/IAsset";
import { ImageAssetReferenceKinds, type ImageAssetReferenceInput } from "@domain/dataset-studio/contracts/ImageAssetReference";
import type { IWorkflowExecutionInput, IWorkflowExecutionResult } from "../ports/interfaces/IWorkflowExecutor";
import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import {
  ImageRunHistoryExecutionStatuses,
  type ImageRunHistoryRecord,
} from "../system-runtime/ImageRunHistoryDataContract";
import type { ImageRunHistoryService } from "../system-runtime/ImageRunHistoryService";
import {
  createWorkflowOutputBindingDescriptorsFromAssetConfiguration,
  type ImageWorkflowOutputBindingConfiguration,
} from "../contracts/ImageWorkflowOutputBindingConfiguration";
import { createImageCrossStudioHandoffContract } from "@domain/studio-handoff/ImageStudioHandoffContract";
import type { SystemDatasetInstanceService } from "../system-runtime/SystemDatasetInstanceService";
import { materializeWorkflowOutputRecords } from "./WorkflowOutputRecordMaterializationService";
import { resolveWorkflowOutputBindingWritePlan } from "./WorkflowOutputBindingResolutionService";

export interface WorkflowRuntimeOutputPersistenceResult {
  readonly status: "skipped" | "persisted" | "failed";
  readonly persistedRecordCount: number;
  readonly targetCount: number;
  readonly results: ReadonlyArray<{
    readonly recordId: string;
    readonly bindingId: string;
    readonly outputId: string;
    readonly targetDatasetInstanceId: string;
    readonly writeMode: "append" | "upsert" | (string & {});
  }>;
  readonly issues: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly bindingId?: string;
    readonly outputId?: string;
  }>;
  readonly handoff?: Readonly<{
    readonly handoffId: string;
    readonly traceId: string;
    readonly workflowBindingId?: string;
    readonly outputDatasetInstanceIds: ReadonlyArray<string>;
    readonly persistedRecordIds: ReadonlyArray<string>;
  }>;
}

export interface WorkflowRuntimeOutputPersistenceService {
  persist(request: {
    readonly input: IWorkflowExecutionInput;
    readonly result: IWorkflowExecutionResult;
  }): Promise<WorkflowRuntimeOutputPersistenceResult>;
}

interface OutputBindingRuntimeMetadata {
  readonly systemId: string;
  readonly configuration: ImageWorkflowOutputBindingConfiguration;
  readonly sourceContext?: {
    readonly sourceImageStableIds?: ReadonlyArray<string>;
    readonly sourceDatasetAssetId?: string;
    readonly sourceDatasetAssetVersionId?: string;
    readonly sourceDatasetInstanceId?: string;
    readonly sourceRecordIds?: ReadonlyArray<string>;
    readonly handoffId?: string;
    readonly traceId?: string;
    readonly workflowBindingId?: string;
    readonly sourceStudioType?: string;
    readonly sourceStudioId?: string;
  };
}

function extractRuntimeMetadata(input: IWorkflowExecutionInput): OutputBindingRuntimeMetadata | undefined {
  const metadata = input.executionMetadata as Record<string, unknown> | undefined;
  const persistence = metadata?.workflowOutputPersistence as Record<string, unknown> | undefined;
  if (!persistence) {
    return undefined;
  }
  const systemId = typeof persistence.systemId === "string" ? persistence.systemId.trim() : "";
  if (!systemId) {
    return undefined;
  }
  const configuration = persistence.configuration as ImageWorkflowOutputBindingConfiguration | undefined;
  if (!configuration || !Array.isArray(configuration.bindings)) {
    return undefined;
  }
  const sourceContext = (persistence.sourceContext && typeof persistence.sourceContext === "object")
    ? persistence.sourceContext as OutputBindingRuntimeMetadata["sourceContext"]
    : undefined;
  const handoffMetadata = metadata?.imageStudioHandoff;
  const handoffContract = handoffMetadata && typeof handoffMetadata === "object"
    ? createImageCrossStudioHandoffContract(handoffMetadata as never)
    : undefined;
  const traceContext = handoffContract
    ? Object.freeze({
      handoffId: handoffContract.handoffId,
      traceId: handoffContract.runtimeInput.trace.traceId,
      workflowBindingId: handoffContract.workflow.bindingId,
      sourceStudioType: handoffContract.sourceStudioType,
      sourceStudioId: handoffContract.sourceStudioId,
    })
    : undefined;
  return Object.freeze({
    systemId,
    configuration,
    sourceContext: Object.freeze({
      ...(sourceContext ?? {}),
      ...(traceContext ?? {}),
    }),
  });
}

function toProducedImage(asset: IAsset, outputId: string, outputIndex: number) {
  const location = asset.location;
  const technical = asset.technicalMetadata;
  const format = location?.format ?? "png";
  const mimeType = location?.contentType;
  const locationValue = location?.location;
  const assetRef: ImageAssetReferenceInput = locationValue
    ? location?.accessMethod === "remote-url"
      ? { kind: ImageAssetReferenceKinds.externalUri, uri: locationValue, stableId: `${asset.id}:uri` }
      : { kind: ImageAssetReferenceKinds.localFile, path: locationValue, stableId: `${asset.id}:path` }
    : { kind: ImageAssetReferenceKinds.generatedOutput, outputId: asset.id, stableId: `${asset.id}:generated` };

  return Object.freeze({
    outputId,
    outputIndex,
    assetRef,
    width: typeof technical?.width === "number" && technical.width > 0 ? technical.width : 1,
    height: typeof technical?.height === "number" && technical.height > 0 ? technical.height : 1,
    format,
    mimeType,
    metadata: Object.freeze({ assetId: asset.id, assetKind: asset.kind }),
    tags: Object.freeze([...(asset.semanticMetadata?.tags ?? [])]),
  });
}

function toCanonicalRecordValue(value: unknown): CanonicalRecordValue {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toCanonicalRecordValue(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toCanonicalRecordValue(entry)]));
  }
  return `${value}`;
}

function toCanonicalSummary(
  value: Readonly<Record<string, unknown>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toCanonicalRecordValue(entry)])));
}

export class DefaultWorkflowRuntimeOutputPersistenceService implements WorkflowRuntimeOutputPersistenceService {
  public constructor(
    private readonly datasetInstanceService: SystemDatasetInstanceService,
    private readonly runHistoryService?: ImageRunHistoryService,
  ) {}

  public async persist(request: {
    readonly input: IWorkflowExecutionInput;
    readonly result: IWorkflowExecutionResult;
  }): Promise<WorkflowRuntimeOutputPersistenceResult> {
    if (request.result.status !== "completed") {
      return Object.freeze({
        status: "skipped",
        persistedRecordCount: 0,
        targetCount: 0,
        results: Object.freeze([]),
        issues: Object.freeze([]),
        handoff: undefined,
      });
    }

    const runtimeMetadata = extractRuntimeMetadata(request.input);
    if (!runtimeMetadata) {
      return Object.freeze({
        status: "skipped",
        persistedRecordCount: 0,
        targetCount: 0,
        results: Object.freeze([]),
        issues: Object.freeze([]),
        handoff: undefined,
      });
    }

    const descriptors = createWorkflowOutputBindingDescriptorsFromAssetConfiguration({
      configuration: runtimeMetadata.configuration,
      workflowRun: {
        workflowAssetId: request.input.workflow.id,
        workflowAssetVersionId: request.input.workflow.metadata?.version,
        workflowRunId: request.result.executionId,
      },
      persistence: { systemId: runtimeMetadata.systemId },
      sourceContext: runtimeMetadata.sourceContext,
    });

    const writePlan = await resolveWorkflowOutputBindingWritePlan({
      systemId: runtimeMetadata.systemId,
      bindings: descriptors,
      datasetInstanceService: this.datasetInstanceService,
    });

    if (!writePlan.ready) {
      this.recordHistory({
        request,
        runtimeMetadata,
        status: ImageRunHistoryExecutionStatuses.failed,
        persistedResults: [],
      });
      return Object.freeze({
        status: "failed",
        persistedRecordCount: 0,
        targetCount: writePlan.plan.length,
        results: Object.freeze([]),
        issues: Object.freeze(writePlan.issues.map((issue) => Object.freeze({
          code: issue.code,
          message: issue.message,
          bindingId: issue.bindingId,
          outputId: issue.outputId,
        }))),
        handoff: runtimeMetadata.sourceContext?.handoffId
          ? Object.freeze({
            handoffId: runtimeMetadata.sourceContext.handoffId,
            traceId: runtimeMetadata.sourceContext.traceId ?? runtimeMetadata.sourceContext.handoffId,
            workflowBindingId: runtimeMetadata.sourceContext.workflowBindingId,
            outputDatasetInstanceIds: Object.freeze([]),
            persistedRecordIds: Object.freeze([]),
          })
          : undefined,
      });
    }

    const outputId = runtimeMetadata.configuration.bindings[0]?.outputId ?? "images";
    const producedImages = request.result.outputAssets
      .filter((asset) => asset.kind === "image")
      .map((asset, index) => toProducedImage(asset, outputId, index));

    const materialized = materializeWorkflowOutputRecords({
      writePlan: writePlan.plan,
      workflowRun: {
        runId: request.result.executionId,
        workflowAssetId: request.input.workflow.id,
        workflowAssetVersionId: request.input.workflow.metadata?.version,
      },
      producedImages,
    });

    if (materialized.missingOutputs.length > 0) {
      this.recordHistory({
        request,
        runtimeMetadata,
        status: ImageRunHistoryExecutionStatuses.failed,
        persistedResults: [],
      });
      return Object.freeze({
        status: "failed",
        persistedRecordCount: 0,
        targetCount: writePlan.plan.length,
        results: Object.freeze([]),
        issues: Object.freeze(materialized.missingOutputs.map((output) => Object.freeze({
          code: "materialization-output-missing",
          message: `No workflow output assets were produced for output '${output}'.`,
          outputId: output,
        }))),
        handoff: runtimeMetadata.sourceContext?.handoffId
          ? Object.freeze({
            handoffId: runtimeMetadata.sourceContext.handoffId,
            traceId: runtimeMetadata.sourceContext.traceId ?? runtimeMetadata.sourceContext.handoffId,
            workflowBindingId: runtimeMetadata.sourceContext.workflowBindingId,
            outputDatasetInstanceIds: Object.freeze([]),
            persistedRecordIds: Object.freeze([]),
          })
          : undefined,
      });
    }

    const persistedResults: WorkflowRuntimeOutputPersistenceResult["results"] = [];
    for (const record of materialized.records) {
      try {
        const existing = this.datasetInstanceService.getImageRecordFromInstance({
          systemId: runtimeMetadata.systemId,
          instanceId: record.targetDatasetInstanceId,
          recordId: record.recordId,
        });

        if (existing && record.writeMode === "upsert") {
          await this.datasetInstanceService.updateImageRecordInInstance({
            systemId: runtimeMetadata.systemId,
            instanceId: record.targetDatasetInstanceId,
            recordId: record.recordId,
            patch: {
              imagePatch: {
                assetRef: record.record.assetRef,
                width: record.record.width,
                height: record.record.height,
                format: record.record.format,
                mimeType: record.record.mimeType ?? null,
                metadataPatch: { replace: record.record.metadata },
                tags: record.record.tags,
                derived: record.record.derived,
              },
              metadataPatch: { replace: record.record.metadata },
              provenancePatch: record.provenance,
              generationPatch: {
                outputAssetRef: record.generation.outputAssetRef,
                sourceImageRef: record.generation.sourceImageRef ?? null,
                workflowAssetId: record.generation.workflowAssetId,
                workflowAssetVersionId: record.generation.workflowAssetVersionId ?? null,
                runId: record.generation.runId,
                role: record.generation.role,
                outputIndex: record.generation.outputIndex ?? null,
                outputGroupId: record.generation.outputGroupId ?? null,
                metadataPatch: { replace: record.generation.metadata },
                tags: record.generation.tags,
              },
            },
          });
        } else {
          await this.datasetInstanceService.ingestImageRecordIntoInstance({
            systemId: runtimeMetadata.systemId,
            instanceId: record.targetDatasetInstanceId,
            recordId: record.recordId,
            record: record.record,
            metadata: record.record.metadata,
            provenance: record.provenance,
          });
          await this.datasetInstanceService.updateImageRecordInInstance({
            systemId: runtimeMetadata.systemId,
            instanceId: record.targetDatasetInstanceId,
            recordId: record.recordId,
            patch: {
              generationPatch: {
                outputAssetRef: record.generation.outputAssetRef,
                sourceImageRef: record.generation.sourceImageRef ?? null,
                workflowAssetId: record.generation.workflowAssetId,
                workflowAssetVersionId: record.generation.workflowAssetVersionId ?? null,
                runId: record.generation.runId,
                role: record.generation.role,
                outputIndex: record.generation.outputIndex ?? null,
                outputGroupId: record.generation.outputGroupId ?? null,
                metadataPatch: { replace: record.generation.metadata },
                tags: record.generation.tags,
              },
            },
          });
        }

        (persistedResults as Array<WorkflowRuntimeOutputPersistenceResult["results"][number]>).push(Object.freeze({
          recordId: record.recordId,
          bindingId: record.bindingId,
          outputId: record.outputId,
          targetDatasetInstanceId: record.targetDatasetInstanceId,
          writeMode: record.writeMode,
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "workflow-output-persistence-failed";
        this.recordHistory({
          request,
          runtimeMetadata,
          status: persistedResults.length > 0
            ? ImageRunHistoryExecutionStatuses.partial
            : ImageRunHistoryExecutionStatuses.failed,
          persistedResults,
        });
        return Object.freeze({
          status: "failed",
          persistedRecordCount: persistedResults.length,
          targetCount: writePlan.plan.length,
          results: Object.freeze([...persistedResults]),
          issues: Object.freeze([Object.freeze({
            code: "workflow-output-persistence-failed",
            message,
            bindingId: record.bindingId,
            outputId: record.outputId,
          })]),
          handoff: runtimeMetadata.sourceContext?.handoffId
            ? Object.freeze({
              handoffId: runtimeMetadata.sourceContext.handoffId,
              traceId: runtimeMetadata.sourceContext.traceId ?? runtimeMetadata.sourceContext.handoffId,
              workflowBindingId: runtimeMetadata.sourceContext.workflowBindingId,
              outputDatasetInstanceIds: Object.freeze(persistedResults.map((entry) => entry.targetDatasetInstanceId)),
              persistedRecordIds: Object.freeze(persistedResults.map((entry) => entry.recordId)),
            })
            : undefined,
        });
      }
    }

    this.recordHistory({
      request,
      runtimeMetadata,
      status: ImageRunHistoryExecutionStatuses.completed,
      persistedResults,
    });

    return Object.freeze({
      status: "persisted",
      persistedRecordCount: persistedResults.length,
      targetCount: writePlan.plan.length,
      results: Object.freeze([...persistedResults]),
      issues: Object.freeze([]),
      handoff: runtimeMetadata.sourceContext?.handoffId
        ? Object.freeze({
          handoffId: runtimeMetadata.sourceContext.handoffId,
          traceId: runtimeMetadata.sourceContext.traceId ?? runtimeMetadata.sourceContext.handoffId,
          workflowBindingId: runtimeMetadata.sourceContext.workflowBindingId,
          outputDatasetInstanceIds: Object.freeze([...new Set(persistedResults.map((entry) => entry.targetDatasetInstanceId))]),
          persistedRecordIds: Object.freeze(persistedResults.map((entry) => entry.recordId)),
        })
        : undefined,
    });
  }

  private recordHistory(input: {
    readonly request: {
      readonly input: IWorkflowExecutionInput;
      readonly result: IWorkflowExecutionResult;
    };
    readonly runtimeMetadata: OutputBindingRuntimeMetadata;
    readonly status: ImageRunHistoryRecord["status"];
    readonly persistedResults: ReadonlyArray<WorkflowRuntimeOutputPersistenceResult["results"][number]>;
  }): void {
    if (!this.runHistoryService) {
      return;
    }

    const inputImages = (input.runtimeMetadata.sourceContext?.sourceImageStableIds ?? [])
      .map((stableId) => stableId.trim())
      .filter(Boolean)
      .map((stableId) => Object.freeze({ stableId }));
    const outputImages = input.request.result.outputAssets
      .filter((asset) => asset.kind === "image")
      .map((asset) => Object.freeze({ outputId: asset.id }));
    const firstTarget = input.persistedResults[0];
    const outputStoreBinding = input.runtimeMetadata.configuration.bindings.find((binding) => binding.targetType === "output-dataset");
    const preferredTarget = outputStoreBinding
      ? input.persistedResults.find((entry) => entry.bindingId === outputStoreBinding.bindingId)
      : undefined;
    const outputDatasetInstance = (preferredTarget ?? firstTarget)
      ? Object.freeze({
        instanceId: (preferredTarget ?? firstTarget).targetDatasetInstanceId,
        datasetAssetId: outputStoreBinding?.datasetAssetId ?? input.runtimeMetadata.configuration.bindings[0]?.datasetAssetId ?? "unknown-dataset-asset",
        datasetAssetVersionId: outputStoreBinding?.datasetAssetVersionId ?? input.runtimeMetadata.configuration.bindings[0]?.datasetAssetVersionId,
        role: "output-store",
        purpose: undefined,
        persistedRecordIds: input.persistedResults.map((entry) => entry.recordId),
      })
      : undefined;
    const lineageStatus = input.status === ImageRunHistoryExecutionStatuses.completed
      ? "complete"
      : input.status === ImageRunHistoryExecutionStatuses.partial
        ? "partial"
        : "incomplete";
    const missingLineage: string[] = [];
    if (!input.runtimeMetadata.sourceContext?.sourceImageStableIds?.length) {
      missingLineage.push("source-image");
    }
    if (!outputDatasetInstance) {
      missingLineage.push("output-dataset-instance");
    }
    if (input.persistedResults.length === 0 && input.status !== ImageRunHistoryExecutionStatuses.failed) {
      missingLineage.push("persisted-output-record");
    }

    this.runHistoryService.recordRun({
      runId: input.request.result.executionId,
      workflowExecutionId: input.request.result.executionId,
      systemId: input.runtimeMetadata.systemId,
      workflowAssetId: input.request.input.workflow.id,
      workflowAssetVersionId: input.request.input.workflow.metadata?.version,
      inputImages,
      outputImages,
      outputDatasetInstance,
      parameterSummary: toCanonicalSummary((input.request.input.parameters ?? {}) as Record<string, unknown>),
      status: input.status,
      lineage: Object.freeze({
        parentRunId: typeof input.request.input.parameters?.parentRunId === "string"
          ? input.request.input.parameters.parentRunId
          : undefined,
        triggerEventId: typeof input.request.input.parameters?.triggerEventId === "string"
          ? input.request.input.parameters.triggerEventId
          : undefined,
        status: lineageStatus,
        workflowExecutionId: input.request.result.executionId,
        sourceDatasetAssetId: input.runtimeMetadata.sourceContext?.sourceDatasetAssetId,
        sourceDatasetInstanceId: input.runtimeMetadata.sourceContext?.sourceDatasetInstanceId,
        sourceImageAssetId: input.runtimeMetadata.sourceContext?.sourceImageStableIds?.[0],
        workflowAssetId: input.request.input.workflow.id,
        workflowAssetVersionId: input.request.input.workflow.metadata?.version,
        systemAssetId: input.runtimeMetadata.systemId,
        outputDatasetInstanceId: outputDatasetInstance?.instanceId,
        outputRecordIds: input.persistedResults.map((entry) => entry.recordId),
        missing: missingLineage,
        traceId: input.runtimeMetadata.sourceContext?.traceId,
      }),
      timestamps: Object.freeze({
        startedAt: input.request.result.startedAt,
        completedAt: input.request.result.completedAt,
        updatedAt: input.request.result.completedAt ?? new Date().toISOString(),
      }),
    });
  }
}

