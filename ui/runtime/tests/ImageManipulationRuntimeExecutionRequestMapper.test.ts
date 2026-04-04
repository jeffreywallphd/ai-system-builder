import { describe, expect, it } from "bun:test";
import { createComfyImageManipulationDefaultConfig } from "../../../application/system-studio/ComfyImageManipulationPropertySchema";
import type { OutputGalleryItem } from "../../../application/system-runtime/OutputGalleryDataContract";
import { mapImageManipulationRuntimeStateToExecutionRequest } from "../ImageManipulationRuntimeExecutionRequestMapper";

function createGalleryItem(input: {
  readonly recordId: string;
  readonly instanceId: string;
  readonly datasetAssetId: string;
  readonly imageReference?: string;
  readonly role: string;
}): OutputGalleryItem {
  return Object.freeze({
    itemId: input.recordId,
    image: Object.freeze({
      recordId: input.recordId,
      selectionId: input.recordId,
      imageReference: input.imageReference,
      width: 1024,
      height: 1024,
      format: "png",
    }),
    dataset: Object.freeze({
      systemId: "system:image",
      instanceId: input.instanceId,
      datasetAssetId: input.datasetAssetId,
      role: input.role,
    }),
    timestamps: Object.freeze({
      admittedAt: "2026-04-03T00:00:00.000Z",
      updatedAt: "2026-04-03T00:00:00.000Z",
    }),
    generationParametersSummary: Object.freeze({}),
    imageMetadataSummary: Object.freeze({
      metadata: Object.freeze({}),
      hasAnnotations: false,
      hasDerived: false,
    }),
    tags: Object.freeze([]),
    derivedAttributes: Object.freeze({}),
  });
}

describe("ImageManipulationRuntimeExecutionRequestMapper", () => {
  it("maps runtime selections/config into backend execution request payloads with logical dataset refs", () => {
    const source = createGalleryItem({
      recordId: "record:source:1",
      instanceId: "dataset-instance:input",
      datasetAssetId: "asset:dataset:image-reference-input",
      imageReference: "asset:image:source:1",
      role: "input",
    });
    const output = createGalleryItem({
      recordId: "record:output:1",
      instanceId: "dataset-instance:output",
      datasetAssetId: "asset:dataset:image-reference-output",
      imageReference: "asset:image:output:1",
      role: "output",
    });

    const result = mapImageManipulationRuntimeStateToExecutionRequest({
      studioId: "studio-system",
      draftId: "draft-system",
      runtimeSessionId: "session-runtime",
      systemAssetId: "asset:system:image",
      workflowAssetId: "asset:workflow:image-runtime",
      workflowAssetVersionId: "asset:workflow:image-runtime:v3",
      presetId: "balanced-default",
      config: createComfyImageManipulationDefaultConfig(),
      roleBindings: Object.freeze({
        sourceBindingId: "input-image-dataset",
        outputBindingId: "output-image-dataset",
        referenceBindingId: "reference-image-dataset",
      }),
      datasetBindingsById: new Map([
        ["input-image-dataset", Object.freeze({
          bindingId: "input-image-dataset",
          role: "input",
          optional: false,
          sharingScope: "shared",
          datasetBindingId: "input-image-dataset",
          datasetAssetId: "asset:dataset:image-reference-input",
          datasetInstanceId: "dataset-instance:input",
          storageInstanceRef: "storage-instance://storage-shared-a",
          storageBindingArea: "input",
          metadata: Object.freeze({}),
        })],
        ["output-image-dataset", Object.freeze({
          bindingId: "output-image-dataset",
          role: "output",
          optional: false,
          sharingScope: "shared",
          datasetBindingId: "output-image-dataset",
          datasetAssetId: "asset:dataset:image-reference-output",
          datasetInstanceId: "dataset-instance:output",
          storageInstanceRef: "storage-instance://storage-shared-a",
          storageBindingArea: "output",
          metadata: Object.freeze({}),
        })],
      ]),
      selectedSource: source,
      selectedOutput: output,
      selectionSnapshot: Object.freeze({
        selectedDatasetBindingId: "input-image-dataset",
        activePreviewRole: "source",
        selectedRecordIds: Object.freeze({
          "input-image-dataset": "record:source:1",
          "output-image-dataset": "record:output:1",
        }),
        gallerySelectionRecordIds: Object.freeze(["record:source:1"]),
      }),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.startRequest.context.runtimeContext.runtime?.workflowAssetId).toBe("asset:workflow:image-runtime");
    const datasetRefs = result.runtimeContext.datasets;
    expect(datasetRefs[0]?.instanceId).toBe("dataset-instance:input");
    expect(datasetRefs[1]?.instanceId).toBe("dataset-instance:output");
    expect(datasetRefs[0]?.metadata?.storageInstanceRef).toBe("storage-instance://storage-shared-a");
    expect(datasetRefs[1]?.metadata?.storageBindingArea).toBe("output");
    expect(result.runtimeContext.parameters.selectionSnapshot).toBeDefined();
    expect(result.sourceAssetId).toBe("asset:image:source:1");
  });

  it("returns normalized failures when FaceID is enabled but no reference image is selected", () => {
    const faceIdConfig = Object.freeze({
      ...createComfyImageManipulationDefaultConfig(),
      faceId: Object.freeze({
        ...createComfyImageManipulationDefaultConfig().faceId,
        enabled: true,
      }),
    });
    const source = createGalleryItem({
      recordId: "record:source:1",
      instanceId: "dataset-instance:input",
      datasetAssetId: "asset:dataset:image-reference-input",
      role: "input",
    });

    const result = mapImageManipulationRuntimeStateToExecutionRequest({
      studioId: "studio-system",
      draftId: "draft-system",
      systemAssetId: "asset:system:image",
      workflowAssetId: "asset:workflow:image-runtime",
      workflowAssetVersionId: "asset:workflow:image-runtime:v3",
      presetId: "identity-focused",
      config: faceIdConfig,
      roleBindings: Object.freeze({
        sourceBindingId: "input-image-dataset",
        outputBindingId: "output-image-dataset",
      }),
      datasetBindingsById: new Map([
        ["input-image-dataset", Object.freeze({
          bindingId: "input-image-dataset",
          role: "input",
          optional: false,
          sharingScope: "shared",
          metadata: Object.freeze({}),
        })],
        ["output-image-dataset", Object.freeze({
          bindingId: "output-image-dataset",
          role: "output",
          optional: false,
          sharingScope: "shared",
          datasetInstanceId: "dataset-instance:output",
          metadata: Object.freeze({}),
        })],
      ]),
      selectedSource: source,
      selectionSnapshot: Object.freeze({
        selectedDatasetBindingId: "input-image-dataset",
        activePreviewRole: "source",
        selectedRecordIds: Object.freeze({
          "input-image-dataset": "record:source:1",
        }),
        gallerySelectionRecordIds: Object.freeze(["record:source:1"]),
      }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.code).toBe("missing-reference-image");
  });
});
