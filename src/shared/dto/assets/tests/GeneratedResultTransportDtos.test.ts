import { describe, expect, it } from "bun:test";
import {
  toGetGeneratedResultLineageSummaryResponseDto,
  toListGeneratedResultsResponseDto,
  toRequestGeneratedResultOriginalAccessResponseDto,
} from "../GeneratedResultTransportDtos";

describe("GeneratedResultTransportDtos", () => {
  it("projects immutable list result DTOs", () => {
    const response = toListGeneratedResultsResponseDto({
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
          hasPreview: true,
          primaryPreviewKind: "display-safe",
          availabilityStatus: "available",
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
      }],
      pagination: {
        limit: 25,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.items[0]?.resultAssetId).toBe("asset:result:1");
  });

  it("projects immutable lineage-summary response DTOs", () => {
    const response = toGetGeneratedResultLineageSummaryResponseDto({
      contractVersion: "generated-result-transport/v1",
      lineage: {
        resultAssetId: "asset:result:1",
        runId: "run:image:1",
        systemId: "system:image",
        workflowId: "workflow:image",
        outputSlot: "output.main",
        inputAssetCount: 2,
        hasWorkflowTemplateVersion: true,
        hasSystemSnapshot: true,
        hasParameterSnapshot: false,
        hasSelectedNode: true,
      },
    });

    expect(Object.isFrozen(response)).toBeTrue();
    expect(response.lineage.hasSystemSnapshot).toBeTrue();
  });

  it("keeps original-access responses metadata-only and path-free", () => {
    const response = toRequestGeneratedResultOriginalAccessResponseDto({
      contractVersion: "generated-result-transport/v1",
      resultAssetId: "asset:result:1",
      original: {
        mediaType: "image/png",
        byteSize: 1024,
        protectedResourceId: "protected-resource://result-original-1",
        accessHandle: "preview-access://result/original/handle-1",
        expiresAt: "2026-04-08T16:00:00.000Z",
      },
    });

    expect((response.original as unknown as { path?: string }).path).toBeUndefined();
    expect(response.original.protectedResourceId).toContain("protected-resource://");
  });
});
