import { describe, expect, it } from "bun:test";
import {
  GeneratedResultTransportSchemaValidationError,
  parseGetGeneratedResultLineageDetailResponseDto,
  parseGetGeneratedResultResponseDto,
  parseListGeneratedResultsResponseDto,
  parseRequestGeneratedResultOriginalAccessResponseDto,
  parseRequestGeneratedResultPreviewResponseDto,
} from "../GeneratedResultTransportSchemaContracts";

describe("GeneratedResultTransportSchemaContracts", () => {
  it("parses generated-result list responses with lineage summary", () => {
    const parsed = parseListGeneratedResultsResponseDto({
      contractVersion: "generated-result-transport/v1",
      items: [{
        resultAssetId: "asset:result:1",
        workspaceId: "workspace:image",
        runId: "run:image:1",
        systemId: "system:image",
        workflowId: "workflow:image",
        outputSlot: "output.main",
        status: "available",
        mediaType: "image/webp",
        visibility: "workspace",
        createdAt: "2026-04-08T15:00:00.000Z",
        updatedAt: "2026-04-08T15:01:00.000Z",
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
          resultAssetId: "asset:result:1",
          runId: "run:image:1",
          systemId: "system:image",
          workflowId: "workflow:image",
          outputSlot: "output.main",
          inputAssetCount: 2,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        },
        reuse: {
          reusableAsWorkflowInput: true,
          logicalAssetReference: "asset-version:1",
          supportedInputPurposes: ["source-image", "reference-image"],
          assetClasses: ["image-asset", "reference-asset"],
          mediaClasses: ["image"],
          sourceContext: {
            runId: "run:image:1",
            workflowId: "workflow:image",
            systemId: "system:image",
            executionNodeId: "node:image:1",
            outputSlot: "output.main",
            inputAssetCount: 2,
          },
        },
      }],
      pagination: {
        limit: 25,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0]?.lineage.inputAssetCount).toBe(2);
  });

  it("parses generated-result detail responses with preview descriptors", () => {
    const parsed = parseGetGeneratedResultResponseDto({
      contractVersion: "generated-result-transport/v1",
      result: {
        resultAssetId: "asset:result:1",
        workspaceId: "workspace:image",
        runId: "run:image:1",
        systemId: "system:image",
        workflowId: "workflow:image",
        outputSlot: "output.main",
        status: "preview-ready",
        mediaType: "image/webp",
        visibility: "workspace",
        createdAt: "2026-04-08T15:00:00.000Z",
        updatedAt: "2026-04-08T15:01:00.000Z",
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
          resultAssetId: "asset:result:1",
          runId: "run:image:1",
          systemId: "system:image",
          workflowId: "workflow:image",
          outputSlot: "output.main",
          inputAssetCount: 2,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        },
        reuse: {
          reusableAsWorkflowInput: true,
          logicalAssetReference: "asset-version:1",
          supportedInputPurposes: ["source-image", "reference-image"],
          assetClasses: ["image-asset", "reference-asset"],
          mediaClasses: ["image"],
          sourceContext: {
            runId: "run:image:1",
            workflowId: "workflow:image",
            systemId: "system:image",
            executionNodeId: "node:image:1",
            outputSlot: "output.main",
            inputAssetCount: 2,
          },
        },
        storage: {
          storageInstanceId: "storage-image-001",
          storageBindingReference: "storage-instance://storage-image-001/output",
        },
        lifecycle: {
          pendingSince: "2026-04-08T15:00:00.000Z",
          logicalAssetVersionId: "asset-version:1",
          persistedAt: "2026-04-08T15:00:10.000Z",
          persistedBy: "user:author",
          previewReadyAt: "2026-04-08T15:00:20.000Z",
          previewReadyBy: "user:author",
        },
        previewDescriptors: [{
          derivativeId: "preview:display-safe:1",
          previewKind: "display-safe",
          availabilityStatus: "available",
          isPrimaryPreview: true,
          mediaType: "image/webp",
          width: 1024,
          height: 1024,
          byteSize: 2048,
          protectedResourceId: "protected-resource://preview-1",
          accessHandle: "preview-access://preview/handle-1",
          accessExpiresAt: "2026-04-08T16:00:00.000Z",
          generatedAt: "2026-04-08T15:00:20.000Z",
        }],
      },
    });

    expect(parsed.result.previewDescriptors[0]?.isPrimaryPreview).toBeTrue();
  });

  it("rejects generated-result detail responses that leak filesystem paths", () => {
    expect(() => parseGetGeneratedResultResponseDto({
      contractVersion: "generated-result-transport/v1",
      result: {
        resultAssetId: "asset:result:1",
        workspaceId: "workspace:image",
        runId: "run:image:1",
        systemId: "system:image",
        workflowId: "workflow:image",
        outputSlot: "output.main",
        status: "preview-ready",
        mediaType: "image/webp",
        visibility: "workspace",
        createdAt: "2026-04-08T15:00:00.000Z",
        updatedAt: "2026-04-08T15:01:00.000Z",
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
          resultAssetId: "asset:result:1",
          runId: "run:image:1",
          systemId: "system:image",
          workflowId: "workflow:image",
          outputSlot: "output.main",
          inputAssetCount: 2,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        },
        reuse: {
          reusableAsWorkflowInput: true,
          logicalAssetReference: "asset-version:1",
          supportedInputPurposes: ["source-image", "reference-image"],
          assetClasses: ["image-asset", "reference-asset"],
          mediaClasses: ["image"],
          sourceContext: {
            runId: "run:image:1",
            workflowId: "workflow:image",
            systemId: "system:image",
            executionNodeId: "node:image:1",
            outputSlot: "output.main",
            inputAssetCount: 2,
          },
        },
        storage: {
          storageInstanceId: "storage-image-001",
          storageBindingReference: "C:\\temp\\leak.png",
        },
        lifecycle: {
          pendingSince: "2026-04-08T15:00:00.000Z",
          logicalAssetVersionId: "asset-version:1",
          persistedAt: "2026-04-08T15:00:10.000Z",
          persistedBy: "user:author",
          previewReadyAt: "2026-04-08T15:00:20.000Z",
          previewReadyBy: "user:author",
        },
        previewDescriptors: [],
      },
    })).toThrow(GeneratedResultTransportSchemaValidationError);
  });

  it("parses preview and original-access responses with protected handles", () => {
    const preview = parseRequestGeneratedResultPreviewResponseDto({
      contractVersion: "generated-result-transport/v1",
      resultAssetId: "asset:result:1",
      preview: {
        state: "preview-available",
        available: true,
        selected: {
          derivativeId: "preview:display-safe:1",
          previewKind: "display-safe",
          availabilityStatus: "available",
          isPrimaryPreview: true,
          mediaType: "image/webp",
          protectedResourceId: "protected-resource://preview-1",
          accessHandle: "preview-access://preview/handle-1",
        },
        alternatives: [],
      },
    });

    const original = parseRequestGeneratedResultOriginalAccessResponseDto({
      contractVersion: "generated-result-transport/v1",
      resultAssetId: "asset:result:1",
      original: {
        state: "retrieval-available",
        mediaType: "image/webp",
        byteSize: 2048,
        protectedResourceId: "protected-resource://result-original-1",
        accessHandle: "preview-access://result/original/handle-1",
        expiresAt: "2026-04-08T16:00:00.000Z",
      },
    });

    expect(preview.preview.available).toBeTrue();
    expect(original.original.protectedResourceId).toContain("protected-resource://");
  });

  it("rejects leaked backend payload internals in responses", () => {
    expect(() => parseRequestGeneratedResultPreviewResponseDto({
      contractVersion: "generated-result-transport/v1",
      resultAssetId: "asset:result:1",
      preview: {
        state: "preview-pending",
        available: false,
        alternatives: [],
      },
      backendResponsePayload: {
        raw: true,
      },
    })).toThrow(GeneratedResultTransportSchemaValidationError);
  });

  it("requires reasonCode when original retrieval is unavailable", () => {
    expect(() => parseRequestGeneratedResultOriginalAccessResponseDto({
      contractVersion: "generated-result-transport/v1",
      resultAssetId: "asset:result:1",
      original: {
        state: "retrieval-unavailable",
        mediaType: "image/webp",
        protectedResourceId: "protected-resource://result-original-1",
        accessHandle: "preview-access://result/original/handle-1",
        expiresAt: "2026-04-08T16:00:00.000Z",
      },
    })).toThrow(GeneratedResultTransportSchemaValidationError);
  });

  it("parses lineage-detail responses for deep inspection", () => {
    const parsed = parseGetGeneratedResultLineageDetailResponseDto({
      contractVersion: "generated-result-transport/v1",
      lineage: {
        summary: {
          resultAssetId: "asset:result:1",
          runId: "run:image:1",
          systemId: "system:image",
          workflowId: "workflow:image",
          outputSlot: "output.main",
          inputAssetCount: 2,
          hasWorkflowTemplateVersion: true,
          hasSystemSnapshot: true,
          hasParameterSnapshot: true,
          hasSelectedNode: true,
        },
        source: {
          workflowTemplateVersionId: "template-version:1",
          workflowTemplateVersionTag: "1.0.0",
          systemSnapshotId: "system-snapshot:1",
          systemVersionTag: "1.0.0",
          parameterSnapshotId: "param-snapshot:1",
          selectedNodeId: "node:image:1",
          executionAdapterKind: "adapter.comfyui",
          executionBackendFamily: "comfyui",
        },
        upstreamInputs: [{
          assetId: "asset:input:1",
        }],
        graph: {
          nodes: [{
            nodeId: "node:result:1",
            nodeType: "result",
            referenceId: "asset:result:1",
          }],
          edges: [],
        },
      },
    });

    expect(parsed.lineage.source.executionBackendFamily).toBe("comfyui");
  });
});
