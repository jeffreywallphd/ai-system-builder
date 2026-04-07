import {
  resolveComfyImageManipulationConfig,
  type ComfyImageManipulationConfig,
} from "@application/system-studio/ComfyImageManipulationPropertySchema";
import type { OutputGalleryItem } from "@application/system-runtime/OutputGalleryDataContract";
import { createSystemContextContract, type SystemContextContract } from "@domain/system-studio/SystemContextContract";
import type {
  HydratedRuntimeDatasetBinding,
} from "./SystemRuntimeWindowHydrationService";
import type { ImageManipulationRoleBindings, ImageManipulationSelectionSnapshot } from "./ImageManipulationRuntimeDatasetBindingService";
import { buildReferenceImageStartRequest } from "./ReferenceImageExecutionRequestBuilder";

type RuntimeImageSelectionRole = "source" | "reference";

export interface MapImageManipulationRuntimeExecutionRequestInput {
  readonly studioId: string;
  readonly draftId: string;
  readonly runtimeSessionId?: string;
  readonly systemAssetId: string;
  readonly workflowAssetId: string;
  readonly workflowAssetVersionId: string;
  readonly presetId: string;
  readonly config: ComfyImageManipulationConfig;
  readonly roleBindings: ImageManipulationRoleBindings;
  readonly datasetBindingsById: ReadonlyMap<string, HydratedRuntimeDatasetBinding>;
  readonly selectedSource?: OutputGalleryItem;
  readonly selectedOutput?: OutputGalleryItem;
  readonly selectedReference?: OutputGalleryItem;
  readonly selectionSnapshot: ImageManipulationSelectionSnapshot;
}

export interface MapImageManipulationRuntimeExecutionRequestSuccess {
  readonly ok: true;
  readonly resolvedConfig: ComfyImageManipulationConfig;
  readonly runtimeContext: SystemContextContract;
  readonly startRequest: ReturnType<typeof buildReferenceImageStartRequest>;
  readonly sourceRecordId: string;
  readonly sourceAssetId: string;
}

export interface MapImageManipulationRuntimeExecutionRequestFailure {
  readonly ok: false;
  readonly code:
    | "invalid-config"
    | "missing-source-image"
    | "missing-source-dataset"
    | "missing-output-dataset"
    | "missing-reference-image";
  readonly userMessage: string;
  readonly technicalMessage?: string;
}

export type MapImageManipulationRuntimeExecutionRequestResult =
  | MapImageManipulationRuntimeExecutionRequestSuccess
  | MapImageManipulationRuntimeExecutionRequestFailure;

function toImageSelection(
  role: RuntimeImageSelectionRole,
  item: OutputGalleryItem,
): SystemContextContract["selectedImages"][number] {
  const recordId = item.image.recordId;
  const assetId = item.image.imageReference
    ?? item.image.thumbnailReference
    ?? recordId;
  return Object.freeze({
    selectionId: recordId,
    imageId: recordId,
    assetRef: Object.freeze({
      assetId,
      recordId,
    }),
    metadata: Object.freeze({
      role,
      datasetInstanceId: item.dataset.instanceId,
    }),
  });
}

function toDatasetReference(input: {
  readonly referenceId: string;
  readonly role: string;
  readonly systemAssetId: string;
  readonly roleBindingId: string;
  readonly hydratedBinding?: HydratedRuntimeDatasetBinding;
  readonly selectedItem?: OutputGalleryItem;
  readonly requiredInstanceId: string;
}): SystemContextContract["datasets"][number] {
  return Object.freeze({
    referenceId: input.referenceId,
    instanceId: input.requiredInstanceId,
    datasetAssetId: input.hydratedBinding?.datasetAssetId ?? input.selectedItem?.dataset.datasetAssetId,
    datasetVersionId: input.hydratedBinding?.datasetAssetVersionId,
    role: input.role,
    systemAssetId: input.systemAssetId,
    metadata: Object.freeze({
      bindingId: input.hydratedBinding?.bindingId ?? input.roleBindingId,
      datasetBindingId: input.hydratedBinding?.datasetBindingId ?? input.roleBindingId,
      sharingScope: input.hydratedBinding?.sharingScope ?? "shared",
      storageInstanceId: input.hydratedBinding?.storageInstanceId,
      storageInstanceRef: input.hydratedBinding?.storageInstanceRef,
      storageBindingArea: input.hydratedBinding?.storageBindingArea,
    }),
  });
}

export function mapImageManipulationRuntimeStateToExecutionRequest(
  input: MapImageManipulationRuntimeExecutionRequestInput,
): MapImageManipulationRuntimeExecutionRequestResult {
  if (!input.selectedSource) {
    return Object.freeze({
      ok: false,
      code: "missing-source-image",
      userMessage: "Choose a source photo before creating an image.",
    });
  }

  const sourceBinding = input.datasetBindingsById.get(input.roleBindings.sourceBindingId);
  const outputBinding = input.datasetBindingsById.get(input.roleBindings.outputBindingId);
  const referenceBinding = input.roleBindings.referenceBindingId
    ? input.datasetBindingsById.get(input.roleBindings.referenceBindingId)
    : undefined;

  const sourceDatasetInstanceId = input.selectedSource.dataset.instanceId
    ?? sourceBinding?.datasetInstanceId;
  if (!sourceDatasetInstanceId) {
    return Object.freeze({
      ok: false,
      code: "missing-source-dataset",
      userMessage: "We couldn't resolve the source image dataset.",
      technicalMessage: `No dataset instance resolved for '${input.roleBindings.sourceBindingId}'.`,
    });
  }

  const outputDatasetInstanceId = outputBinding?.datasetInstanceId
    ?? input.selectedOutput?.dataset.instanceId;
  if (!outputDatasetInstanceId) {
    return Object.freeze({
      ok: false,
      code: "missing-output-dataset",
      userMessage: "We couldn't resolve where to save created images.",
      technicalMessage: `No dataset instance resolved for '${input.roleBindings.outputBindingId}'.`,
    });
  }

  let resolvedConfig: ComfyImageManipulationConfig;
  try {
    resolvedConfig = resolveComfyImageManipulationConfig(input.config, {
      presetId: input.presetId,
    });
  } catch (error) {
    return Object.freeze({
      ok: false,
      code: "invalid-config",
      userMessage: "Review your settings before creating an image.",
      technicalMessage: error instanceof Error ? error.message : "Image configuration is invalid.",
    });
  }
  if (resolvedConfig.faceId.enabled && !input.selectedReference) {
    return Object.freeze({
      ok: false,
      code: "missing-reference-image",
      userMessage: "Choose a face reference photo or turn off identity guidance.",
      technicalMessage: "FaceID-enabled execution requires a selected reference image.",
    });
  }

  const selectedImages = [
    toImageSelection("source", input.selectedSource),
    ...(input.selectedReference ? [toImageSelection("reference", input.selectedReference)] : []),
  ];
  const datasets = [
    toDatasetReference({
      referenceId: "active-input",
      role: "active-input",
      systemAssetId: input.systemAssetId,
      roleBindingId: input.roleBindings.sourceBindingId,
      hydratedBinding: sourceBinding,
      selectedItem: input.selectedSource,
      requiredInstanceId: sourceDatasetInstanceId,
    }),
    toDatasetReference({
      referenceId: "system-output",
      role: "system-owned-output",
      systemAssetId: input.systemAssetId,
      roleBindingId: input.roleBindings.outputBindingId,
      hydratedBinding: outputBinding,
      selectedItem: input.selectedOutput,
      requiredInstanceId: outputDatasetInstanceId,
    }),
    ...(input.selectedReference && input.roleBindings.referenceBindingId
      ? [toDatasetReference({
        referenceId: "face-reference",
        role: "reference-input",
        systemAssetId: input.systemAssetId,
        roleBindingId: input.roleBindings.referenceBindingId,
        hydratedBinding: referenceBinding,
        selectedItem: input.selectedReference,
        requiredInstanceId: input.selectedReference.dataset.instanceId,
      })]
      : []),
  ];

  const runtimeContext = createSystemContextContract({
    selectedImages,
    parameters: Object.freeze({
      editInstruction: resolvedConfig.prompts.positivePrompt,
      variationStrength: resolvedConfig.generation.variationStrength,
      resultCount: resolvedConfig.output.resultCount,
      imageConfig: resolvedConfig,
      presetId: input.presetId,
      selectedReferenceRecordId: input.selectedReference?.image.recordId,
      selectionSnapshot: input.selectionSnapshot,
    }),
    datasets,
    runtime: Object.freeze({
      runtimeSessionId: input.runtimeSessionId,
      systemAssetId: input.systemAssetId,
      workflowAssetId: input.workflowAssetId,
      sourceStudio: "system-studio",
    }),
    extensions: Object.freeze({
      workflowAssetVersionId: input.workflowAssetVersionId,
      outputDatasetBindingId: input.roleBindings.outputBindingId,
      inputDatasetBindingId: input.roleBindings.sourceBindingId,
      referenceDatasetBindingId: input.roleBindings.referenceBindingId,
    }),
  });

  const startRequest = buildReferenceImageStartRequest({
    studioId: input.studioId,
    draftId: input.draftId,
    systemAssetId: input.systemAssetId,
    runtimeContext,
  });

  const sourceRecordId = input.selectedSource.image.recordId;
  const sourceAssetId = input.selectedSource.image.imageReference
    ?? input.selectedSource.image.thumbnailReference
    ?? sourceRecordId;

  return Object.freeze({
    ok: true,
    resolvedConfig,
    runtimeContext,
    startRequest,
    sourceRecordId,
    sourceAssetId,
  });
}

