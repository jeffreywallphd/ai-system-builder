import { describe, expect, it } from "bun:test";
import { ToolStore } from "../ToolStore";

function createToolService() {
  return {
    async listPublishedTools() {
      return {
        tools: [
          {
            id: "wf:research-digest",
            slug: "research-digest",
            title: "Research Digest",
            description: "Digest a bounded set of notes.",
            typeId: "workflow",
            typeLabel: "Workflow",
          },
        ],
        availableTypes: [{ id: "workflow", label: "Workflow" }],
      };
    },
    async listToolCapabilities() {
      return {
        capabilities: [
          {
            id: "workflow:research-digest",
            displayName: "Research Digest",
            provider: { kind: "workflow", id: "workflow-projection", label: "Workflow Tools" },
            source: { workflowId: "wf:research-digest" },
            publication: { isPublished: true, title: "Research Digest" },
          },
        ],
      };
    },
    async searchCapabilities() {
      return {
        query: "research",
        limit: 6,
        totalCandidateCount: 1,
        truncated: false,
        sources: { toolCapabilities: 1, mcpServers: 0, mcpResources: 0 },
        candidates: [
          {
            id: "workflow:research-digest",
            kind: "tool-capability",
            title: "Research Digest",
            score: 100,
            matchReasons: ["substring-primary-match"],
          },
        ],
      };
    },
    async loadToolDefinition() {
      throw new Error("unused");
    },
    async runTool() {
      throw new Error("unused");
    },
    async invokeToolCapability() {
      throw new Error("unused");
    },
  };
}

describe("ToolStore", () => {
  it("tracks tool loading, run state, and bounded capability search results", async () => {
    const store = new ToolStore(createToolService() as any);

    await store.refreshTools({ query: "research" });

    expect(store.getState().tools).toHaveLength(1);
    expect(store.getState().capabilities).toHaveLength(1);
    expect(store.getState().capabilitySearchResult?.candidates[0]?.title).toBe("Research Digest");
  });
});
