import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type { SystemContextContract } from "../../domain/system-studio/SystemContextContract";
import {
  createDefaultSystemContextDatasetReferenceResolver,
  type ResolveSystemContextDatasetsResult,
  type SystemContextDatasetReferenceResolver,
} from "./SystemContextDatasetReferenceResolver";

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function inferRecordValueType(value: unknown): "string" | "number" | "boolean" | "array" | "object" | "unknown" {
  if (typeof value === "string") {
    return "string";
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (value && typeof value === "object") {
    return "object";
  }
  return "unknown";
}

export interface WorkflowSystemContextBindingAdapter {
  readonly map: (context: SystemContextContract) => WorkflowExecutionPlanTranslationRequest["context"];
}

export interface CreateWorkflowSystemContextBindingAdapterOptions {
  readonly datasetReferenceResolver?: SystemContextDatasetReferenceResolver;
}

function mapDatasetResolutionToMetadata(
  resolution: ResolveSystemContextDatasetsResult,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    resolvedCount: resolution.resolved.length,
    unresolvedCount: resolution.unresolved.length,
    issueCount: resolution.issues.length,
    issues: Object.freeze(resolution.issues.map((issue) => Object.freeze({ ...issue }))),
    resolvedReferences: Object.freeze(resolution.resolved.map((entry) => Object.freeze({
      referenceId: entry.referenceId,
      instanceId: entry.instanceId,
      role: entry.role,
      runtimeHandle: entry.runtimeHandle,
    }))),
  });
}

export function createDefaultWorkflowSystemContextBindingAdapter(
  options: CreateWorkflowSystemContextBindingAdapterOptions = {},
): WorkflowSystemContextBindingAdapter {
  const datasetReferenceResolver = options.datasetReferenceResolver ?? createDefaultSystemContextDatasetReferenceResolver();

  return Object.freeze({
    map: (context) => {
      const selectedImage = context.selectedImages[0];
      const datasetResolution = datasetReferenceResolver.resolve({ datasets: context.datasets });

      const datasetInstances = datasetResolution.resolved.map((reference) => Object.freeze({
        instanceId: reference.instanceId,
        purpose: reference.role,
        datasetAssetId: reference.datasetAssetId,
        datasetVersionId: reference.datasetVersionId,
        systemId: reference.systemAssetId,
        schema: {
          recordValueType: inferRecordValueType(reference.sampleRecordValue),
        },
        records: reference.sampleRecords,
        runtimeHandle: reference.runtimeHandle,
      }));

      const systemDatasetInstanceRefs = datasetResolution.resolved
        .filter((reference) => reference.role !== "active-input")
        .map((reference) => Object.freeze({
          instanceId: reference.instanceId,
          role: reference.role,
          datasetAssetId: reference.datasetAssetId,
          systemAssetId: reference.systemAssetId,
          runtimeHandle: reference.runtimeHandle,
        }));

      const metadata: Record<string, unknown> = {
        systemContext: context,
        systemFormValues: context.parameters,
        uiFormValues: context.parameters,
        formValues: context.parameters,
        selectedImages: context.selectedImages,
        datasetResolution: mapDatasetResolutionToMetadata(datasetResolution),
      };

      if (selectedImage) {
        metadata.selectedImage = Object.freeze({
          selectionId: selectedImage.selectionId,
          imageId: selectedImage.imageId,
          assetRef: selectedImage.assetRef,
          ...(asRecord(selectedImage.metadata) ? { metadata: selectedImage.metadata } : {}),
        });
      }

      if (datasetInstances.length > 0) {
        metadata.datasetInstances = Object.freeze(datasetInstances);
        metadata.datasetInstanceReferences = Object.freeze(datasetInstances);
        metadata.datasetRuntimeHandles = Object.freeze(datasetResolution.resolved.map((reference) => reference.runtimeHandle));
      }

      if (systemDatasetInstanceRefs.length > 0) {
        metadata.systemDatasetInstanceRefs = Object.freeze(systemDatasetInstanceRefs);
      }

      if (context.runtime.runtimeSessionId || context.runtime.workflowRunId || context.runtime.selectorSessionId) {
        metadata.runtimeContext = Object.freeze({
          runtimeSessionId: context.runtime.runtimeSessionId,
          workflowRunId: context.runtime.workflowRunId,
          selectorSessionId: context.runtime.selectorSessionId,
        });
      }

      return Object.freeze({
        inputValues: Object.freeze({ ...context.parameters }),
        metadata: Object.freeze(metadata),
      });
    },
  });
}
