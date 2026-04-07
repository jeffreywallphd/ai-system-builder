import { describe, expect, it } from "bun:test";
import { ImageManipulationRuntimeDatasetBindingService } from "../ImageManipulationRuntimeDatasetBindingService";

describe("ImageManipulationRuntimeDatasetBindingService", () => {
  it("resolves role bindings and reconciles hydrated selections with available items", () => {
    const service = new ImageManipulationRuntimeDatasetBindingService();
    const roleBindings = service.resolveRoleBindings([
      {
        bindingId: "input-image-dataset",
        datasetBindingId: "input-image-dataset",
        role: "input",
        optional: false,
        sharingScope: "shared",
        metadata: {},
      },
      {
        bindingId: "output-image-dataset",
        datasetBindingId: "output-image-dataset",
        role: "output",
        optional: false,
        sharingScope: "shared",
        metadata: {},
      },
      {
        bindingId: "reference-image-dataset",
        datasetBindingId: "reference-image-dataset",
        role: "reference",
        optional: true,
        sharingScope: "shared",
        metadata: {},
      },
    ]);

    const result = service.reconcileSelection({
      roleBindings,
      hydratedSelection: {
        selectedDatasetBindingId: "reference-image-dataset",
        activePreviewRole: "reference",
        selectedRecordIds: {
          "input-image-dataset": "source-2",
          "output-image-dataset": "output-2",
          "reference-image-dataset": "reference-2",
        },
        gallerySelectionRecordIds: [],
      },
      collections: {
        sourceItems: [
          {
            itemId: "source-2",
            image: {
              recordId: "source-2",
              selectionId: "source-2",
              width: 512,
              height: 512,
              format: "png",
            },
            dataset: {
              systemId: "asset:system:image",
              instanceId: "dataset-instance:input",
              datasetAssetId: "asset:dataset:image-reference-input",
              role: "input",
            },
            timestamps: {
              admittedAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
            },
            generationParametersSummary: {},
            imageMetadataSummary: {
              metadata: {},
              hasAnnotations: false,
              hasDerived: false,
            },
            tags: [],
            derivedAttributes: {},
          },
        ],
        outputItems: [
          {
            itemId: "output-2",
            image: {
              recordId: "output-2",
              selectionId: "output-2",
              width: 512,
              height: 512,
              format: "png",
            },
            dataset: {
              systemId: "asset:system:image",
              instanceId: "dataset-instance:output",
              datasetAssetId: "asset:dataset:image-reference-output",
              role: "output",
            },
            timestamps: {
              admittedAt: "2026-04-03T00:00:00.000Z",
              updatedAt: "2026-04-03T00:00:00.000Z",
            },
            generationParametersSummary: {},
            imageMetadataSummary: {
              metadata: {},
              hasAnnotations: false,
              hasDerived: false,
            },
            tags: [],
            derivedAttributes: {},
          },
        ],
        referenceItems: [],
      },
    });

    expect(roleBindings.sourceBindingId).toBe("input-image-dataset");
    expect(roleBindings.outputBindingId).toBe("output-image-dataset");
    expect(roleBindings.referenceBindingId).toBe("reference-image-dataset");
    expect(result.selection.activePreviewRole).toBe("output");
    expect(result.selection.sourceRecordId).toBe("source-2");
    expect(result.selection.outputRecordId).toBe("output-2");
    expect(result.selection.referenceRecordId).toBeUndefined();
    expect(result.serializedSelection.selectedRecordIds["output-image-dataset"]).toBe("output-2");
    expect(result.serializedSelection.gallerySelectionRecordIds).toEqual(["output-2"]);
  });
});

