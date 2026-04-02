import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type { SystemContextContract } from "../../domain/system-studio/SystemContextContract";

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

export interface WorkflowSystemContextBindingAdapter {
  readonly map: (context: SystemContextContract) => WorkflowExecutionPlanTranslationRequest["context"];
}

export function createDefaultWorkflowSystemContextBindingAdapter(): WorkflowSystemContextBindingAdapter {
  return Object.freeze({
    map: (context) => {
      const selectedImage = context.selectedImages[0];
      const datasetInstances = context.datasets
        .map((reference) => {
          if (!reference.instanceId) {
            return undefined;
          }
          return Object.freeze({
            instanceId: reference.instanceId,
            purpose: reference.role,
            datasetAssetId: reference.datasetAssetId,
            datasetVersionId: reference.datasetVersionId,
            systemId: reference.systemAssetId,
          });
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const systemDatasetInstanceRefs = context.datasets
        .filter((reference) => reference.instanceId && reference.role !== "active-input")
        .map((reference) => Object.freeze({
          instanceId: reference.instanceId!,
          role: reference.role,
          datasetAssetId: reference.datasetAssetId,
          systemAssetId: reference.systemAssetId,
        }));

      const metadata: Record<string, unknown> = {
        systemContext: context,
        systemFormValues: context.parameters,
        uiFormValues: context.parameters,
        formValues: context.parameters,
        selectedImages: context.selectedImages,
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
