import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { ImageAssetReferenceInput } from "../../domain/dataset-studio/contracts/ImageAssetReference";
import {
  DatasetInstanceImageGenerationRoles,
  type DatasetInstanceImageGeneration,
  type DatasetInstanceImageGenerationRole,
} from "../../domain/system-runtime/DatasetInstanceRecordDomain";
import type { ResolvedWorkflowOutputWritePlanItem } from "./WorkflowOutputBindingResolutionService";

export interface WorkflowExecutionProducedImage {
  readonly outputId: string;
  readonly assetRef: ImageAssetReferenceInput;
  readonly width: number;
  readonly height: number;
  readonly format: string;
  readonly mimeType?: string;
  readonly metadata?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly tags?: ReadonlyArray<string>;
  readonly outputIndex?: number;
  readonly role?: DatasetInstanceImageGenerationRole;
}

export interface MaterializeWorkflowOutputRecordsRequest {
  readonly writePlan: ReadonlyArray<ResolvedWorkflowOutputWritePlanItem>;
  readonly workflowRun: Readonly<{
    readonly runId: string;
    readonly workflowAssetId: string;
    readonly workflowAssetVersionId?: string;
  }>;
  readonly producedImages: ReadonlyArray<WorkflowExecutionProducedImage>;
  readonly parameterContext?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly timestamp?: string;
}

export interface MaterializedWorkflowOutputRecord {
  readonly outputId: string;
  readonly bindingId: string;
  readonly targetDatasetInstanceId: string;
  readonly writeMode: ResolvedWorkflowOutputWritePlanItem["writeMode"];
  readonly recordId: string;
  readonly record: Readonly<{
    readonly assetRef: ImageAssetReferenceInput;
    readonly width: number;
    readonly height: number;
    readonly format: string;
    readonly mimeType?: string;
    readonly metadata: Readonly<Record<string, CanonicalRecordValue>>;
    readonly tags: ReadonlyArray<string>;
    readonly derived: Readonly<Record<string, CanonicalRecordValue>>;
  }>;
  readonly provenance: Readonly<{
    readonly sourceType: "workflow-output-materialized";
    readonly sourceReference: string;
    readonly sourceSystemId: string;
    readonly sourceRunId: string;
    readonly ingestedBy: string;
  }>;
  readonly generation: DatasetInstanceImageGeneration;
}

export interface MaterializeWorkflowOutputRecordsResult {
  readonly records: ReadonlyArray<MaterializedWorkflowOutputRecord>;
  readonly missingOutputs: ReadonlyArray<string>;
}

function normalizeTags(tags?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean)))]);
}

function resolveGenerationRole(role?: DatasetInstanceImageGenerationRole): DatasetInstanceImageGenerationRole {
  if (role) {
    return role;
  }
  return DatasetInstanceImageGenerationRoles.primary;
}

export function materializeWorkflowOutputRecords(
  request: MaterializeWorkflowOutputRecordsRequest,
): MaterializeWorkflowOutputRecordsResult {
  const records: MaterializedWorkflowOutputRecord[] = [];
  const missingOutputs: string[] = [];
  const timestamp = request.timestamp?.trim() || new Date().toISOString();

  for (const planItem of request.writePlan) {
    const produced = request.producedImages
      .filter((image) => image.outputId === planItem.outputId)
      .sort((left, right) => (left.outputIndex ?? 0) - (right.outputIndex ?? 0));
    if (produced.length === 0) {
      missingOutputs.push(planItem.outputId);
      continue;
    }

    produced.forEach((image, index) => {
      const outputIndex = image.outputIndex ?? index;
      const role = resolveGenerationRole(image.role);
      const recordId = `${planItem.bindingId}:${request.workflowRun.runId}:${outputIndex}`;
      const tags = normalizeTags([...(planItem.recordEnvelope.defaultTags ?? []), ...(image.tags ?? [])]);
      const metadata: Record<string, CanonicalRecordValue> = {
        outputId: planItem.outputId,
        bindingId: planItem.bindingId,
        runId: request.workflowRun.runId,
        workflowAssetId: request.workflowRun.workflowAssetId,
        writeMode: planItem.writeMode,
        materializedAt: timestamp,
        ...(request.parameterContext ? { parameterContext: request.parameterContext } : {}),
        ...(planItem.recordEnvelope.metadata as Record<string, CanonicalRecordValue>),
        ...(image.metadata ?? {}),
      };

      const generation: DatasetInstanceImageGeneration = Object.freeze({
        outputAssetRef: image.assetRef,
        workflowAssetId: request.workflowRun.workflowAssetId,
        workflowAssetVersionId: request.workflowRun.workflowAssetVersionId,
        runId: request.workflowRun.runId,
        role,
        outputIndex,
        outputGroupId: planItem.lineage.outputGroupId ?? `run:${request.workflowRun.runId}:${planItem.outputId}`,
        metadata: Object.freeze({
          ...metadata,
          sourceOutputId: planItem.outputId,
        }),
        tags,
      });

      records.push(Object.freeze({
        outputId: planItem.outputId,
        bindingId: planItem.bindingId,
        targetDatasetInstanceId: planItem.target.datasetInstanceId,
        writeMode: planItem.writeMode,
        recordId,
        record: Object.freeze({
          assetRef: image.assetRef,
          width: image.width,
          height: image.height,
          format: image.format,
          mimeType: image.mimeType,
          metadata: Object.freeze(metadata),
          tags,
          derived: Object.freeze({
            outputIndex,
            outputRole: role,
            targetType: planItem.target.targetType,
            targetId: planItem.target.targetId,
            targetDatasetInstanceId: planItem.target.datasetInstanceId,
          }),
        }),
        provenance: Object.freeze({
          sourceType: "workflow-output-materialized",
          sourceReference: `${planItem.bindingId}:${outputIndex}`,
          sourceSystemId: request.workflowRun.workflowAssetId,
          sourceRunId: request.workflowRun.runId,
          ingestedBy: "workflow-output-record-materialization-service",
        }),
        generation,
      }));
    });
  }

  return Object.freeze({
    records: Object.freeze(records),
    missingOutputs: Object.freeze(missingOutputs),
  });
}
