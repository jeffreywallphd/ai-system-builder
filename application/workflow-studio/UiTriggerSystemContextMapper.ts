import type { WorkflowExecutionPlanTranslationRequest } from "./WorkflowExecutionAlignmentContracts";
import type { UiTriggerEvent } from "./UiTriggerEventContract";

function asRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Readonly<Record<string, unknown>>;
}

function toRuntimeParameters(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  const runtime = asRecord(payload.parameters);
  if (runtime) {
    return Object.freeze({ ...runtime });
  }

  const values = asRecord(payload.values);
  const merged: Record<string, unknown> = {
    ...(values ?? {}),
  };

  for (const [key, value] of Object.entries(payload)) {
    if (key === "values" || key === "parameters") {
      continue;
    }
    merged[key] = value;
  }

  return Object.freeze(merged);
}

function toSelectedImage(payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  const explicit = asRecord(payload.selectedImage);
  if (explicit) {
    return Object.freeze({ ...explicit });
  }

  const imageId = typeof payload.imageId === "string" && payload.imageId.trim().length > 0
    ? payload.imageId.trim()
    : undefined;
  if (!imageId) {
    return undefined;
  }

  return Object.freeze({
    imageId,
    assetRef: Object.freeze({
      assetId: imageId,
    }),
  });
}

export interface UiTriggerSystemContextMapper {
  readonly map: (event: UiTriggerEvent) => WorkflowExecutionPlanTranslationRequest["context"];
}

export function createDefaultUiTriggerSystemContextMapper(): UiTriggerSystemContextMapper {
  return Object.freeze({
    map: (event) => {
      const runtimeParameters = toRuntimeParameters(event.payload);
      const formValues = asRecord(event.payload.values) ?? runtimeParameters;
      const references = event.context?.references ?? {};
      const metadata: Record<string, unknown> = {
        systemFormValues: formValues,
      };

      const selectedImage = toSelectedImage(event.payload);
      if (selectedImage) {
        metadata.selectedImage = selectedImage;
      }

      if (event.context?.datasetAssetId) {
        metadata.datasetInstances = Object.freeze([
          Object.freeze({
            instanceId: event.context.references?.datasetInstanceId ?? "ui-dataset-instance",
            purpose: "active-input",
            datasetAssetId: event.context.datasetAssetId,
            datasetVersionId: event.context.datasetVersionId,
            systemId: event.context.systemAssetId,
          }),
        ]);
      }

      const systemDatasetInstanceId = typeof references.systemDatasetInstanceId === "string"
        ? references.systemDatasetInstanceId.trim()
        : "";
      if (systemDatasetInstanceId) {
        metadata.systemDatasetInstanceRefs = Object.freeze([
          Object.freeze({
            instanceId: systemDatasetInstanceId,
            role: typeof references.systemDatasetRole === "string" ? references.systemDatasetRole : "system-owned",
            datasetAssetId: event.context?.datasetAssetId,
            systemAssetId: event.context?.systemAssetId,
          }),
        ]);
      }

      const runtimeSessionId = typeof references.runtimeSessionId === "string" && references.runtimeSessionId.trim().length > 0
        ? references.runtimeSessionId
        : undefined;
      if (runtimeSessionId) {
        metadata.runtimeContext = Object.freeze({
          runtimeSessionId,
          workflowRunId: event.context?.workflowRunId,
          selectorSessionId: event.context?.selectorSessionId,
        });
      }

      return Object.freeze({
        inputValues: runtimeParameters,
        metadata: Object.freeze(metadata),
      });
    },
  });
}
