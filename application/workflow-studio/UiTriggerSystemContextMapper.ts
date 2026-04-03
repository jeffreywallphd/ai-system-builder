import type { UiTriggerEvent } from "./UiTriggerEventContract";
import {
  createSystemContextContract,
  type SystemContextContract,
  type SystemContextDatasetReference,
  type SystemContextImageReference,
} from "../../domain/system-studio/SystemContextContract";

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

function toSelectedImages(payload: Readonly<Record<string, unknown>>): ReadonlyArray<SystemContextImageReference> {
  const explicitSelectedImage = asRecord(payload.selectedImage);
  if (explicitSelectedImage) {
    const imageId = typeof explicitSelectedImage.imageId === "string" && explicitSelectedImage.imageId.trim().length > 0
      ? explicitSelectedImage.imageId.trim()
      : undefined;
    const explicitAssetRef = asRecord(explicitSelectedImage.assetRef);
    const assetRef = explicitAssetRef && typeof explicitAssetRef.assetId === "string" && explicitAssetRef.assetId.trim().length > 0
      ? Object.freeze({
        assetId: explicitAssetRef.assetId.trim(),
        versionId: typeof explicitAssetRef.versionId === "string" ? explicitAssetRef.versionId.trim() || undefined : undefined,
        recordId: typeof explicitAssetRef.recordId === "string" ? explicitAssetRef.recordId.trim() || undefined : undefined,
        uri: typeof explicitAssetRef.uri === "string" ? explicitAssetRef.uri.trim() || undefined : undefined,
      })
      : undefined;

    return Object.freeze([Object.freeze({
      selectionId: imageId ?? "selected-image-1",
      imageId,
      assetRef,
      metadata: Object.freeze({ ...explicitSelectedImage }),
    })]);
  }

  const imageId = typeof payload.imageId === "string" && payload.imageId.trim().length > 0
    ? payload.imageId.trim()
    : undefined;
  if (!imageId) {
    return Object.freeze([]);
  }

  return Object.freeze([
    Object.freeze({
      selectionId: imageId,
      imageId,
      assetRef: Object.freeze({
        assetId: imageId,
      }),
    }),
  ]);
}

function toDatasetReferences(event: UiTriggerEvent): ReadonlyArray<SystemContextDatasetReference> {
  const references: SystemContextDatasetReference[] = [];

  if (event.context?.datasetAssetId) {
    references.push(Object.freeze({
      referenceId: event.context.references?.datasetInstanceId ?? "active-input-dataset",
      instanceId: event.context.references?.datasetInstanceId,
      role: "active-input",
      datasetAssetId: event.context.datasetAssetId,
      datasetVersionId: event.context.datasetVersionId,
      systemAssetId: event.context.systemAssetId,
    }));
  }

  const systemDatasetInstanceId = typeof event.context?.references?.systemDatasetInstanceId === "string"
    ? event.context.references.systemDatasetInstanceId.trim()
    : "";
  if (systemDatasetInstanceId) {
    references.push(Object.freeze({
      referenceId: systemDatasetInstanceId,
      instanceId: systemDatasetInstanceId,
      role: typeof event.context?.references?.systemDatasetRole === "string"
        ? event.context.references.systemDatasetRole
        : "system-owned",
      datasetAssetId: event.context?.datasetAssetId,
      datasetVersionId: event.context?.datasetVersionId,
      systemAssetId: event.context?.systemAssetId,
    }));
  }

  return Object.freeze(references);
}

export interface UiTriggerSystemContextMapper {
  readonly map: (event: UiTriggerEvent) => SystemContextContract;
}

export function createDefaultUiTriggerSystemContextMapper(): UiTriggerSystemContextMapper {
  return Object.freeze({
    map: (event) => {
      const parameters = toRuntimeParameters(event.payload);
      const selectedImages = toSelectedImages(event.payload);
      const datasets = toDatasetReferences(event);
      const references = event.context?.references ?? {};

      return createSystemContextContract({
        selectedImages,
        parameters,
        datasets,
        runtime: {
          runtimeSessionId: typeof references.runtimeSessionId === "string" ? references.runtimeSessionId : undefined,
          workflowRunId: event.context?.workflowRunId,
          selectorSessionId: event.context?.selectorSessionId,
          systemAssetId: event.context?.systemAssetId,
          workflowAssetId: event.context?.workflowAssetId,
          sourceStudio: event.source.studio,
          triggerEventId: event.eventId,
          triggerName: event.name,
        },
        extensions: {
          triggerKind: event.kind,
          uiContextReferences: references,
        },
      });
    },
  });
}
