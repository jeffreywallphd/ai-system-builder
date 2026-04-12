import { describe, expect, it } from "bun:test";
import {
  ImageWorkflowSystemApiSchemaValidationError,
  parseCreateImageSystemRequestDto,
  parseCreateImageWorkflowRequestDto,
  parseListImageSystemsResponseDto,
} from "../ImageWorkflowSystemApiSchemaContracts";

function createWorkflowPayload() {
  return {
    contractVersion: "image-workflow-system-api/v1",
    actorUserIdentityId: "user:workflow-admin-1",
    workspaceId: "workspace:alpha",
    workflow: {
      workflowId: "wf:image:portrait-restyle",
      workspaceId: "workspace:alpha",
      title: "Portrait Restyle",
      summary: "Reusable portrait restyle workflow",
      tags: ["portrait", "restyle"],
      operationKind: "restyle",
      lifecycleState: "draft",
      activationStatus: "inactive",
      version: {
        lineageId: "lineage:workflow:portrait-restyle",
        versionTag: "1.0.0",
        revision: 0,
      },
      compatibility: {
        contractVersion: "image-workflow-system-api/v1",
        supportedClients: ["desktop", "thin-client"],
        executionAdapterId: "image-comfy-adapter",
        executionAdapterVersion: "2026.04",
      },
      inputSlots: [{
        slotId: "sourceImage",
        label: "Source image",
        purpose: "source-image",
        required: true,
        cardinality: "one",
        minimumAssetCount: 1,
        allowedAssetClasses: ["image-asset"],
        allowedMediaClasses: ["image/png", "image/jpeg"],
      }],
      outputSlots: [{
        slotId: "generatedImages",
        label: "Generated images",
        purpose: "generated-image-collection",
        required: true,
        cardinality: "many",
        minimumAssetCount: 1,
        emittedAssetClasses: ["generated-image-asset"],
        emittedMediaClasses: ["image/png", "image/webp"],
      }],
      parameterSpecifications: [{
        parameterId: "prompt",
        label: "Prompt",
        valueKind: "text",
        semanticMeaning: "prompt",
        required: true,
        sensitivity: "normal",
        validation: {
          minLength: 3,
          maxLength: 512,
        },
        ui: {
          control: "text-area",
        },
      }],
      createdBy: "user:workflow-admin-1",
      lastModifiedBy: "user:workflow-admin-1",
      createdAt: "2026-04-08T14:00:00.000Z",
      updatedAt: "2026-04-08T14:00:00.000Z",
    },
  };
}

describe("ImageWorkflowSystemApiSchemaContracts", () => {
  it("parses create workflow requests with typed slots and parameters", () => {
    const parsed = parseCreateImageWorkflowRequestDto(createWorkflowPayload());
    expect(parsed.workflow.workflowId).toBe("wf:image:portrait-restyle");
    expect(parsed.workflow.parameterSpecifications).toHaveLength(1);
  });

  it("rejects leaked raw graph internals from workflow payloads", () => {
    const payload = createWorkflowPayload();
    (payload.workflow as Record<string, unknown>).graphJson = { nodes: [] };

    expect(() => parseCreateImageWorkflowRequestDto(payload)).toThrow(ImageWorkflowSystemApiSchemaValidationError);
  });

  it("rejects filesystem-style references in system bindings", () => {
    expect(() => parseCreateImageSystemRequestDto({
      contractVersion: "image-workflow-system-api/v1",
      actorUserIdentityId: "user:system-admin-1",
      workspaceId: "workspace:alpha",
      system: {
        systemId: "sys:image:portrait-restyle",
        workspaceId: "workspace:alpha",
        title: "Portrait Restyle System",
        tags: ["portrait"],
        lifecycleState: "draft",
        runtimeStatus: "disabled",
        workflowBinding: {
          workflowId: "wf:image:portrait-restyle",
          workflowVersionTag: "1.0.0",
          workflowRevision: 0,
          workflowLineageId: "lineage:workflow:portrait-restyle",
        },
        inputBindings: [{
          bindingId: "input.source",
          slotId: "sourceImage",
          assets: [{
            assetReferenceId: "C:\\temp\\source.png",
            assetClass: "image-asset",
          }],
        }],
        outputBindings: [],
        parameterValues: [],
        lineage: {
          latestOutputAssetIds: [],
        },
        compatibility: {
          contractVersion: "image-workflow-system-api/v1",
          supportedClients: ["desktop", "thin-client"],
          executionAdapterId: "image-comfy-adapter",
          executionAdapterVersion: "2026.04",
        },
        createdBy: "user:system-admin-1",
        lastModifiedBy: "user:system-admin-1",
        createdAt: "2026-04-08T14:00:00.000Z",
        updatedAt: "2026-04-08T14:00:00.000Z",
      },
    })).toThrow(ImageWorkflowSystemApiSchemaValidationError);
  });

  it("parses list system responses with readiness projections", () => {
    const parsed = parseListImageSystemsResponseDto({
      contractVersion: "image-workflow-system-api/v1",
      items: [{
        systemId: "sys:image:portrait-restyle",
        workspaceId: "workspace:alpha",
        title: "Portrait Restyle System",
        lifecycleState: "ready",
        runtimeStatus: "enabled",
        workflowBinding: {
          workflowId: "wf:image:portrait-restyle",
          workflowVersionTag: "1.0.0",
          workflowRevision: 0,
          workflowLineageId: "lineage:workflow:portrait-restyle",
        },
        readiness: {
          state: "configuration-runnable",
          ready: true,
          checkedAt: "2026-04-08T14:10:00.000Z",
        },
        updatedAt: "2026-04-08T14:10:00.000Z",
      }],
      pagination: {
        limit: 25,
        offset: 0,
        returned: 1,
        hasMore: false,
      },
    });

    expect(parsed.items[0]?.readiness.state).toBe("configuration-runnable");
    expect(parsed.pagination.returned).toBe(1);
  });
});
