import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createBrowserImageUploadIngestionAdapter } from "../image-system/BrowserImageUploadIngestionAdapter";
import { ImageComparisonView } from "../image-system/ImageComparisonView";
import { ImageHistoryLinkedOutputInspectorAsset, ImageOutputGalleryAsset, ImageResultHistoryInteractionSpaceAsset, ImageRunHistoryAsset } from "../image-system/ImageComposedAssets";
import { ImageOutputGallery } from "../image-system/ImageOutputGallery";
import { ImageParameterForm } from "../image-system/ImageParameterForm";
import { mapImageRunHistoryListingToViewModels } from "../image-system/ImageRunHistoryDataAdapter";
import { ImageRunHistoryList } from "../image-system/ImageRunHistoryList";
import { ImageUploadPanel } from "../image-system/ImageUploadPanel";
import { ImageViewer } from "../image-system/ImageViewer";
import { createInitialImageInterfaceState, mapStateToComparisonProps, mapStateToOutputGalleryProps } from "../image-system/ImageSystemStateIntegration";
import { mapAssetContractParametersToImageParameters } from "../image-system/ImageParameterMappers";
import { DEFAULT_IMAGE_RENDER_OPTIONS, type ImageUiViewModel } from "../image-system/ImageUiContracts";
import { mapOutputGalleryListingToImageInterfaceState } from "../image-system/ImageOutputGalleryDataAdapter";

describe("image-system components", () => {
  it("maps browser file validation through ingestion policy contracts", () => {
    const adapter = createBrowserImageUploadIngestionAdapter({
      policy: {
        acceptedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
        acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        maxFileSizeBytes: 1024,
        conversion: {
          mode: "forbidden",
          allowedOutputFormats: ["markdown"],
          passThroughExtensions: [".png", ".jpg", ".jpeg", ".webp"],
          passThroughMimeTypes: ["image/png", "image/jpeg", "image/webp"],
        },
      },
    });

    const result = adapter.evaluate({
      files: [
        new File([new Uint8Array(10)], "ok.png", { type: "image/png" }),
        new File([new Uint8Array(10)], "bad.gif", { type: "image/gif" }),
      ],
      acceptedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
      maxUploadCount: 2,
    });

    expect(result.acceptedFiles.length).toBe(1);
    expect(result.rejectedFiles.length).toBe(1);
    expect(result.issues.some((issue) => issue.severity === "error")).toBeTrue();
  });

  it("renders upload panel and image viewer with reusable contracts", () => {
    const image: ImageUiViewModel = {
      imageId: "image-1",
      sourceUrl: "https://example.com/image.png",
      title: "Sample image",
      metadata: {
        width: 512,
        height: 320,
        format: "png",
      },
      tags: ["sample"],
    };

    const uploadHtml = renderToStaticMarkup(
      React.createElement(ImageUploadPanel, {
        acceptedMimeTypes: ["image/png", "image/jpeg"],
        configuredSavePath: "/tmp/ai-loom-studio/reference-image-uploads",
      }),
    );
    const viewerHtml = renderToStaticMarkup(
      React.createElement(ImageViewer, {
        image,
        renderOptions: {
          ...DEFAULT_IMAGE_RENDER_OPTIONS,
          fitMode: "contain",
          zoomCapability: "buttons",
        },
      }),
    );
    const formHtml = renderToStaticMarkup(
      React.createElement(ImageParameterForm, {
        imageId: "image-1",
        parameters: [
          { parameterId: "prompt", label: "Prompt", type: "text", required: true },
          { parameterId: "guidance", label: "Guidance", type: "range", min: 1, max: 20, step: 1, defaultValue: 7 },
        ],
        initialValues: { prompt: "A mountain sunrise" },
      }),
    );
    const galleryHtml = renderToStaticMarkup(
      React.createElement(ImageOutputGallery, {
        items: [image],
        renderOptions: DEFAULT_IMAGE_RENDER_OPTIONS,
        datasetContext: { datasetAssetId: "dataset-images", datasetVersionId: "v1" },
        presentationMode: "list",
      }),
    );
    const comparisonHtml = renderToStaticMarkup(
      React.createElement(ImageComparisonView, {
        items: [
          { image, label: "Before" },
          { image: { ...image, imageId: "image-2", title: "After" }, label: "After" },
        ],
        mode: "side-by-side",
        renderOptions: DEFAULT_IMAGE_RENDER_OPTIONS,
      }),
    );

    expect(uploadHtml).toContain("Upload images");
    expect(uploadHtml).toContain("Choose files");
    expect(uploadHtml).toContain("Upload save path");
    expect(viewerHtml).toContain("Fit: contain");
    expect(viewerHtml).toContain("Dimensions");
    expect(formHtml).toContain("Parameters");
    expect(formHtml).toContain("Prompt");
    expect(galleryHtml).toContain("Output gallery");
    expect(galleryHtml).toContain("dataset-images");
    expect(galleryHtml).toContain("Select");
    expect(comparisonHtml).toContain("Image comparison");
    expect(comparisonHtml).toContain("Before vs After");
  });

  it("maps asset contract parameters into image form definitions through an adapter seam", () => {
    const mapped = mapAssetContractParametersToImageParameters([
      { id: "prompt", required: true, valueType: "text", defaultValue: "hello" },
      { id: "guidanceScale", required: false, valueType: "slider", defaultValue: 7 },
      { id: "seed", required: false, valueType: "integer" },
    ]);

    expect(mapped).toEqual([
      expect.objectContaining({ parameterId: "prompt", type: "text", required: true, defaultValue: "hello" }),
      expect.objectContaining({ parameterId: "guidanceScale", type: "range", required: false, defaultValue: 7 }),
      expect.objectContaining({ parameterId: "seed", type: "number", required: false }),
    ]);
  });

  it("maps image interface state into reusable component props", () => {
    const imageA: ImageUiViewModel = {
      imageId: "img-a",
      sourceUrl: "https://example.com/a.png",
      title: "A",
      metadata: {},
      tags: [],
    };
    const imageB: ImageUiViewModel = {
      imageId: "img-b",
      sourceUrl: "https://example.com/b.png",
      title: "B",
      metadata: {},
      tags: [],
    };

    const state = createInitialImageInterfaceState({
      imageCollection: [imageA, imageB],
      selectedImageId: "img-b",
      datasetRef: { datasetAssetId: "dataset-1", datasetVersionId: "v2" },
      interaction: { comparisonMode: "overlay", loadingByComponent: {}, errorByComponent: {} },
    });

    const galleryProps = mapStateToOutputGalleryProps(state, DEFAULT_IMAGE_RENDER_OPTIONS);
    const comparisonProps = mapStateToComparisonProps(state, DEFAULT_IMAGE_RENDER_OPTIONS);

    expect(galleryProps.selection?.selectedIds).toEqual(["img-b"]);
    expect(galleryProps.datasetContext?.datasetAssetId).toBe("dataset-1");
    expect(comparisonProps.mode).toBe("overlay");
    expect(comparisonProps.items.length).toBe(2);
  });

  it("adapts dataset-backed output gallery listings into image interface state", () => {
    const statePatch = mapOutputGalleryListingToImageInterfaceState({
      kind: "output-gallery-items",
      summary: {
        systemId: "system:image",
        datasetInstanceId: "instance:outputs",
        datasetAssetId: "asset:dataset:outputs",
        datasetAssetVersionId: "v1",
        role: "system-output",
        totalItems: 1,
        returnedItems: 1,
        truncated: false,
      },
      window: {
        offset: 0,
        limit: 20,
        hasPreviousWindow: false,
        hasNextWindow: false,
      },
      items: [{
        itemId: "instance:outputs:record:1:1",
        image: {
          recordId: "record:1",
          selectionId: "record:1",
          imageReference: "storage://outputs/record-1.png",
          thumbnailReference: "storage://outputs/record-1-thumb.png",
          width: 512,
          height: 512,
          format: "png",
        },
        dataset: {
          systemId: "system:image",
          instanceId: "instance:outputs",
          datasetAssetId: "asset:dataset:outputs",
          datasetAssetVersionId: "v1",
          role: "system-output",
        },
        workflow: {
          workflowRunId: "run:1",
          workflowAssetId: "asset:workflow:image",
          generationRole: "primary",
        },
        timestamps: {
          admittedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:10.000Z",
        },
        generationParametersSummary: { prompt: "studio portrait" },
        imageMetadataSummary: { metadata: { prompt: "studio portrait" }, hasAnnotations: false, hasDerived: true },
        tags: ["generated", "portrait"],
        derivedAttributes: { orientation: "square" },
      }],
    });

    expect(statePatch.datasetRef?.datasetInstanceId).toBe("instance:outputs");
    expect(statePatch.systemRef?.systemAssetId).toBe("system:image");
    expect(statePatch.imageCollection[0]?.imageId).toBe("record:1");
    expect(statePatch.imageCollection[0]?.context?.workflowRunId).toBe("run:1");
    expect(statePatch.imageCollection[0]?.previewSummary?.workflowSummary).toContain("asset:workflow:image");
  });

  it("adapts and renders persisted run history read models", () => {
    const listing = {
      kind: "image-run-history" as const,
      summary: {
        systemId: "system:image",
        totalRuns: 1,
        returnedRuns: 1,
        truncated: false,
      },
      window: {
        offset: 0,
        limit: 20,
        hasPreviousWindow: false,
        hasNextWindow: false,
      },
      runs: [{
        runId: "run:1",
        workflowExecutionId: "exec:1",
        system: { systemId: "system:image" },
        workflow: { workflowAssetId: "asset:workflow:image" },
        inputs: {
          parameterSummary: { prompt: "portrait", guidance: 7 },
          images: [{ stableId: "img:1" }],
        },
        outputs: {
          datasetInstance: {
            instanceId: "instance:out",
            datasetAssetId: "asset:dataset:outputs",
            role: "system-output",
            persistedRecordIds: ["record:1", "record:2"],
          },
          images: [{ recordId: "record:1" }],
        },
        status: "completed" as const,
        timestamps: {
          requestedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:10.000Z",
        },
      }],
    };

    const runs = mapImageRunHistoryListingToViewModels(listing);
    expect(runs[0]?.ioSummary).toBe("1 input / 2 output");
    expect(runs[0]?.linkedOutputImageIds).toEqual(["record:1", "record:2"]);

    const historyHtml = renderToStaticMarkup(React.createElement(ImageRunHistoryList, { runs }));
    expect(historyHtml).toContain("Run history");
    expect(historyHtml).toContain("asset:workflow:image");

    const composedHistoryHtml = renderToStaticMarkup(React.createElement(ImageRunHistoryAsset, { listing }));
    expect(composedHistoryHtml).toContain("Persisted run history");

    const composedGalleryHtml = renderToStaticMarkup(React.createElement(ImageOutputGalleryAsset, {
      mode: "grid",
      listing: {
        kind: "output-gallery-items",
        summary: {
          systemId: "system:image",
          datasetInstanceId: "instance:outputs",
          datasetAssetId: "asset:dataset:outputs",
          role: "system-output",
          totalItems: 1,
          returnedItems: 1,
          truncated: false,
        },
        window: {
          offset: 0,
          limit: 20,
          hasPreviousWindow: false,
          hasNextWindow: false,
        },
        items: [{
          itemId: "item:1",
          image: {
            recordId: "record:1",
            selectionId: "record:1",
            imageReference: "storage://outputs/record-1.png",
            width: 512,
            height: 512,
            format: "png",
          },
          dataset: {
            systemId: "system:image",
            instanceId: "instance:outputs",
            datasetAssetId: "asset:dataset:outputs",
            role: "system-output",
          },
          workflow: {
            workflowRunId: "run:1",
            workflowAssetId: "asset:workflow:image",
            generationRole: "primary",
          },
          timestamps: {
            admittedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:10.000Z",
          },
          generationParametersSummary: { prompt: "portrait" },
          imageMetadataSummary: { metadata: { prompt: "portrait" }, hasAnnotations: false, hasDerived: true },
          tags: [],
          derivedAttributes: {},
        }],
      },
    }));

    expect(composedGalleryHtml).toContain("Persisted output gallery");

    const linkedInspectorHtml = renderToStaticMarkup(React.createElement(ImageHistoryLinkedOutputInspectorAsset, {
      runsWithOutputs: [{
        run: listing.runs[0],
        linkedOutputs: [{
          itemId: "item:linked:1",
          image: {
            recordId: "record:1",
            selectionId: "record:1",
            imageReference: "storage://outputs/record-1.png",
            width: 512,
            height: 512,
            format: "png",
          },
          dataset: {
            systemId: "system:image",
            instanceId: "instance:out",
            datasetAssetId: "asset:dataset:outputs",
            role: "system-output",
          },
          workflow: {
            workflowRunId: "run:1",
            workflowAssetId: "asset:workflow:image",
            generationRole: "primary",
          },
          timestamps: {
            admittedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:10.000Z",
          },
          generationParametersSummary: { prompt: "portrait" },
          imageMetadataSummary: { metadata: { prompt: "portrait" }, hasAnnotations: false, hasDerived: false },
          tags: [],
          derivedAttributes: {},
        }],
      }],
    }));
    expect(linkedInspectorHtml).toContain("History-linked output inspector");
    expect(linkedInspectorHtml).toContain("Lineage mini-view");

    const interactionSpaceHtml = renderToStaticMarkup(React.createElement(ImageResultHistoryInteractionSpaceAsset, {
      runsWithOutputs: [{
        run: listing.runs[0],
        linkedOutputs: [{
          itemId: "item:linked:1",
          image: {
            recordId: "record:1",
            selectionId: "record:1",
            imageReference: "storage://outputs/record-1.png",
            width: 512,
            height: 512,
            format: "png",
          },
          dataset: {
            systemId: "system:image",
            instanceId: "instance:out",
            datasetAssetId: "asset:dataset:outputs",
            role: "system-output",
          },
          workflow: {
            workflowRunId: "run:1",
            workflowAssetId: "asset:workflow:image",
            generationRole: "primary",
          },
          timestamps: {
            admittedAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:10.000Z",
          },
          generationParametersSummary: { prompt: "portrait" },
          imageMetadataSummary: { metadata: { prompt: "portrait" }, hasAnnotations: false, hasDerived: false },
          tags: [],
          derivedAttributes: {},
        }],
      }],
    }));
    expect(interactionSpaceHtml).toContain("Image system interaction space");
    expect(interactionSpaceHtml).toContain("Lineage mini-view");
  });
});
