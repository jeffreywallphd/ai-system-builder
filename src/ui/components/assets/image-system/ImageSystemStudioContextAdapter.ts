import type { SystemStudioContextExtractionSource } from "@application/workflow-studio/SystemStudioContextExtraction";
import type { ImageInterfaceState } from "./ImageSystemStateIntegration";

export function mapImageInterfaceStateToSystemContextSource(
  state: ImageInterfaceState,
  input?: {
    readonly workflowAssetId?: string;
    readonly workflowRunId?: string;
    readonly sourceStudio?: string;
  },
): SystemStudioContextExtractionSource {
  const selectedImage = state.selectedImageId
    ? state.imageCollection.find((image) => image.imageId === state.selectedImageId)
    : undefined;

  return Object.freeze({
    selectedImages: selectedImage
      ? Object.freeze([Object.freeze({
        selectionId: selectedImage.imageId,
        imageId: selectedImage.imageId,
        assetRef: selectedImage.context?.dataset?.datasetAssetId
          ? Object.freeze({
            assetId: selectedImage.context.dataset.datasetAssetId,
            versionId: selectedImage.context.dataset.datasetVersionId,
            recordId: selectedImage.imageId,
            uri: selectedImage.sourceUrl,
          })
          : selectedImage.sourceUrl
            ? Object.freeze({
              assetId: selectedImage.imageId,
              recordId: selectedImage.imageId,
              uri: selectedImage.sourceUrl,
            })
            : undefined,
        metadata: Object.freeze({
          ...selectedImage.metadata,
          tags: selectedImage.tags,
        }),
      })])
      : Object.freeze([]),
    parameterValues: Object.freeze({ ...state.parameterValues }),
    datasets: state.datasetRef
      ? Object.freeze([Object.freeze({
        referenceId: state.datasetRef.datasetInstanceId ?? "active-input-dataset",
        instanceId: state.datasetRef.datasetInstanceId,
        datasetAssetId: state.datasetRef.datasetAssetId,
        datasetVersionId: state.datasetRef.datasetVersionId,
        role: "active-input",
        systemAssetId: state.systemRef?.systemAssetId,
        metadata: Object.freeze({
          schemaIntentId: "media",
        }),
      })])
      : Object.freeze([]),
    runtime: Object.freeze({
      runtimeSessionId: state.systemRef?.runtimeSessionId,
      systemAssetId: state.systemRef?.systemAssetId,
      workflowAssetId: input?.workflowAssetId ?? selectedImage?.context?.workflowAssetId,
      workflowRunId: input?.workflowRunId ?? selectedImage?.context?.workflowRunId,
      sourceStudio: input?.sourceStudio ?? "system-studio",
    }),
  });
}

