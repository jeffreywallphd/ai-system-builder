import { describe, expect, it } from "bun:test";
import {
  buildGeneratedResultPreviewContentUrl,
  mapGeneratedResultToOutputGalleryItem,
  mapGeneratedResultsToRunHistory,
} from "../image-manipulation/GeneratedResultGalleryHistoryAdapter";

describe("GeneratedResultGalleryHistoryAdapter", () => {
  it("builds preview-content URLs with workspace and preview token context", () => {
    const url = buildGeneratedResultPreviewContentUrl({
      baseUrl: "http://identity.local",
      workspaceId: "workspace-alpha",
      preview: {
        resultAssetId: "gr-asset-001",
        workspaceId: "workspace-alpha",
        state: "preview-available",
        available: true,
        selected: {
          derivativeId: "preview-1",
          previewKind: "display-safe",
          mediaType: "image/webp",
          previewToken: "preview-token-001",
          contentEndpoint: "/api/v1/generated-results/gr-asset-001/preview/content",
        },
        alternatives: [],
      },
    });
    expect(url).toContain("workspaceId=workspace-alpha");
    expect(url).toContain("previewToken=preview-token-001");
  });

  it("maps generated-result summaries into output gallery items", () => {
    const item = mapGeneratedResultToOutputGalleryItem({
      summary: {
        resultAssetId: "gr-asset-001",
        workspaceId: "workspace-alpha",
        runId: "run-001",
        systemId: "system-001",
        workflowId: "workflow-001",
        outputSlot: "primary",
        status: "preview-ready",
        mediaType: "image/webp",
        visibility: "workspace",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T01:00:00.000Z",
        preview: {
          state: "preview-available",
          hasPreview: true,
          primaryPreviewKind: "display-safe",
          availabilityStatus: "available",
        },
        retrieval: {
          state: "retrieval-available",
        },
        lineage: {
          resultAssetId: "gr-asset-001",
          runId: "run-001",
          systemId: "system-001",
          workflowId: "workflow-001",
          outputSlot: "primary",
          inputAssetCount: 1,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        },
        reuse: {
          reusableAsWorkflowInput: true,
          logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
          supportedInputPurposes: ["source-image"],
          assetClasses: ["image-asset"],
          mediaClasses: ["image"],
          sourceContext: {
            runId: "run-001",
            workflowId: "workflow-001",
            systemId: "system-001",
            outputSlot: "primary",
            inputAssetCount: 1,
          },
        },
      },
      previewUrl: "http://identity.local/api/v1/generated-results/gr-asset-001/preview/content?workspaceId=workspace-alpha&previewToken=preview-token-001",
    });

    expect(item.image.recordId).toBe("gr-asset-001");
    expect(item.image.imageReference).toContain("previewToken=preview-token-001");
    expect(item.workflow?.workflowRunId).toBe("run-001");
  });

  it("groups generated-result summaries into run history records", () => {
    const runs = mapGeneratedResultsToRunHistory([
      {
        resultAssetId: "gr-asset-001",
        workspaceId: "workspace-alpha",
        runId: "run-001",
        systemId: "system-001",
        workflowId: "workflow-001",
        outputSlot: "primary",
        status: "preview-ready",
        mediaType: "image/webp",
        visibility: "workspace",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T01:00:00.000Z",
        preview: { state: "preview-available", hasPreview: true },
        retrieval: { state: "retrieval-available" },
        lineage: {
          resultAssetId: "gr-asset-001",
          runId: "run-001",
          systemId: "system-001",
          workflowId: "workflow-001",
          outputSlot: "primary",
          inputAssetCount: 1,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        },
        reuse: {
          reusableAsWorkflowInput: true,
          logicalAssetReference: "storage-instance://storage-alpha/generated-results/run-001/output-001.png",
          supportedInputPurposes: ["source-image"],
          assetClasses: ["image-asset"],
          mediaClasses: ["image"],
          sourceContext: {
            runId: "run-001",
            workflowId: "workflow-001",
            systemId: "system-001",
            outputSlot: "primary",
            inputAssetCount: 1,
          },
        },
      },
    ]);

    expect(runs).toHaveLength(1);
    expect(runs[0]?.runId).toBe("run-001");
    expect(runs[0]?.outputs.images[0]?.recordId).toBe("gr-asset-001");
  });
});
