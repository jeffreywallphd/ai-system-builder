import { describe, expect, it } from "bun:test";
import { ListToolCapabilitiesUseCase } from "../ListToolCapabilitiesUseCase";
import type { IToolCapabilityCatalog } from "../../ports/interfaces/IToolCapabilityCatalog";
import {
  buildToolCapabilityId,
  type ToolCapabilityDescriptor,
} from "../models/ToolCapabilityDescriptor";

describe("ListToolCapabilitiesUseCase", () => {
  it("lists capabilities across workflow, local, and MCP providers with stable metadata", async () => {
    const catalog: IToolCapabilityCatalog = {
      async listCapabilities(): Promise<ReadonlyArray<ToolCapabilityDescriptor>> {
        return Object.freeze([
          {
            id: buildToolCapabilityId("mcp", "runtime", "echo"),
            identity: { stableId: "mcp:runtime:echo", providerScopedId: "runtime:echo" },
            routingName: "echo",
            displayName: "Echo",
            provider: Object.freeze({ kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" }),
            source: Object.freeze({ kind: "mcp", serverId: "runtime", toolName: "echo" }),
            publication: Object.freeze({ isPublished: false }),
          },
          {
            id: buildToolCapabilityId("workflow", "wf-image"),
            identity: { stableId: "wf-image", providerScopedId: "wf-image" },
            routingName: "image-creator",
            displayName: "Image Creator",
            description: "Generate images from a published workflow.",
            provider: Object.freeze({ kind: "workflow", id: "workflow-projection", label: "Workflow Tools" }),
            source: Object.freeze({ kind: "workflow", workflowId: "wf-image", workflowToolId: "wf-image", workflowToolSlug: "image-creator" }),
            publication: Object.freeze({
              isPublished: true,
              title: "Image Creator",
              description: "Generate images from a published workflow.",
              category: "media",
              slug: "image-creator",
            }),
          },
          {
            id: buildToolCapabilityId("local", "asset-inspector"),
            identity: { stableId: "asset-inspector", providerScopedId: "asset-inspector" },
            routingName: "asset-inspector",
            displayName: "Asset Inspector",
            provider: Object.freeze({ kind: "local", id: "local-runtime", label: "Local Tools" }),
            source: Object.freeze({ kind: "local", localToolName: "asset-inspector" }),
            publication: Object.freeze({ isPublished: false, title: "Asset Inspector" }),
          },
          {
            id: buildToolCapabilityId("workflow", "wf-image"),
            identity: { stableId: "wf-image-duplicate", providerScopedId: "wf-image" },
            routingName: "duplicate-image-creator",
            displayName: "Duplicate Image Creator",
            provider: Object.freeze({ kind: "workflow", id: "workflow-projection", label: "Workflow Tools" }),
            source: Object.freeze({ kind: "workflow", workflowId: "wf-image" }),
            publication: Object.freeze({ isPublished: true }),
          },
        ]);
      },
    };

    const result = await new ListToolCapabilitiesUseCase(catalog).execute();

    expect(result.capabilities.map((capability) => capability.displayName)).toEqual([
      "Asset Inspector",
      "Echo",
      "Image Creator",
    ]);
    expect(result.capabilities[2]?.id).toBe("workflow:wf-image");
    expect(result.capabilities[2]?.routingName).toBe("image-creator");
    expect(result.capabilities[2]?.identity.stableId).toBe("wf-image");
    expect(result.capabilities[2]?.source.workflowToolSlug).toBe("image-creator");
    expect(result.capabilities[2]?.publication.category).toBe("media");
  });
});
