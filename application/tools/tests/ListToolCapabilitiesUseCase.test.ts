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
          Object.freeze({
            id: buildToolCapabilityId("mcp", "runtime", "echo"),
            displayName: "Echo",
            provider: Object.freeze({ kind: "mcp", id: "python-mcp-runtime", label: "MCP Tools" }),
            source: Object.freeze({ serverId: "runtime", toolName: "echo" }),
            publication: Object.freeze({ isPublished: false }),
          }),
          Object.freeze({
            id: buildToolCapabilityId("workflow", "wf-image"),
            displayName: "Image Creator",
            description: "Generate images from a published workflow.",
            provider: Object.freeze({ kind: "workflow", id: "workflow-projection", label: "Workflow Tools" }),
            source: Object.freeze({ workflowId: "wf-image", workflowToolId: "wf-image", workflowToolSlug: "image-creator" }),
            publication: Object.freeze({
              isPublished: true,
              title: "Image Creator",
              description: "Generate images from a published workflow.",
              category: "media",
              slug: "image-creator",
            }),
          }),
          Object.freeze({
            id: buildToolCapabilityId("local", "asset-inspector"),
            displayName: "Asset Inspector",
            provider: Object.freeze({ kind: "local", id: "local-runtime", label: "Local Tools" }),
            source: Object.freeze({ localToolName: "asset-inspector" }),
            publication: Object.freeze({ isPublished: false, title: "Asset Inspector" }),
          }),
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
    expect(result.capabilities[2]?.source.workflowToolSlug).toBe("image-creator");
    expect(result.capabilities[2]?.publication.category).toBe("media");
  });
});
