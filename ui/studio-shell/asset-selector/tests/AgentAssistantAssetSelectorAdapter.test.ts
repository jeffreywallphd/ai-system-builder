import { describe, expect, it } from "bun:test";
import {
  AssetSelectorApplicationValidationService,
  AssetSelectorUsageContexts,
  createDefaultAssetSelectorCapabilityRegistry,
} from "../../../../application/studio-entry/AssetSelectorCapabilityRegistry";
import {
  createAgentAssistantAssetSelectorRequest,
  AgentAssistantAssetSelectorAdapter,
} from "../AgentAssistantAssetSelectorAdapter";

describe("AgentAssistantAssetSelectorAdapter", () => {
  it("builds workflow-step single-select requests by default", () => {
    const request = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow-step:agent",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });

    const validation = new AssetSelectorApplicationValidationService(createDefaultAssetSelectorCapabilityRegistry())
      .validateRequest(request);

    expect(validation.valid).toBeTrue();
    expect(request.context.usageContext).toBe(AssetSelectorUsageContexts.workflowStep);
    expect(request.selectionMode).toBe("single-select");
    expect(request.constraints.maxSelections).toBe(1);
  });

  it("supports multi-select mode when explicitly requested", () => {
    const request = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow-step:agent:multi",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
      selectionMode: "multi-select",
      maxSelections: 3,
    });

    expect(request.selectionMode).toBe("multi-select");
    expect(request.constraints.maxSelections).toBe(3);
  });

  it("maps valid agent rows and excludes deleted/invalid-role rows", async () => {
    const provider = new AgentAssistantAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          return {
            ok: true,
            data: [{
              assetId: "asset:agent:planner",
              versionId: "asset:agent:planner:v1",
              name: "Planner Agent",
              kind: "agent",
              status: "published",
              taxonomy: {
                structuralKind: "composite",
                semanticRole: "agent",
                behaviorKind: "autonomous",
              },
              provenance: {
                sourceLabel: "Agent Studio",
                upstreamAssets: [],
                directUpstreamVersionIds: [],
                directDownstreamVersionIds: [],
              },
              dependencies: [],
              versionHistory: [],
              lineage: {
                upstream: [],
                downstream: [],
              },
            }, {
              assetId: "asset:agent:deleted",
              versionId: "asset:agent:deleted:v1",
              name: "Deleted Agent",
              kind: "agent",
              status: "deleted",
              taxonomy: {
                structuralKind: "composite",
                semanticRole: "agent",
                behaviorKind: "autonomous",
              },
              provenance: {
                upstreamAssets: [],
                directUpstreamVersionIds: [],
                directDownstreamVersionIds: [],
              },
              dependencies: [],
              versionHistory: [],
              lineage: {
                upstream: [],
                downstream: [],
              },
            }, {
              assetId: "asset:dataset:not-agent",
              versionId: "asset:dataset:not-agent:v1",
              name: "Not Agent",
              kind: "dataset",
              status: "published",
              taxonomy: {
                structuralKind: "atomic",
                semanticRole: "dataset",
                behaviorKind: "none",
              },
              provenance: {
                upstreamAssets: [],
                directUpstreamVersionIds: [],
                directDownstreamVersionIds: [],
              },
              dependencies: [],
              versionHistory: [],
              lineage: {
                upstream: [],
                downstream: [],
              },
            }],
          } as const;
        },
        async searchAssets() {
          throw new Error("not used");
        },
      },
    });

    const request = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow-step:agent",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });

    const result = await provider.query({
      request,
      searchTerm: "",
    });

    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.asset.assetId).toBe("asset:agent:planner");
    expect(result.items[0]?.asset.assetType).toBe("agent");
  });

  it("returns error details when agent registry queries fail", async () => {
    const provider = new AgentAssistantAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          return {
            ok: false,
            error: {
              message: "bridge unavailable",
            },
          } as const;
        },
        async searchAssets() {
          return {
            ok: false,
            error: {
              message: "bridge unavailable",
            },
          } as const;
        },
      },
    });

    const request = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow-step:agent",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });

    const result = await provider.query({
      request,
      searchTerm: "agent",
    });

    expect(result.items).toEqual([]);
    expect(result.error).toContain("bridge unavailable");
  });

  it("reuses short-lived query cache entries to avoid duplicate fetches during rehydration", async () => {
    let filterCallCount = 0;
    const provider = new AgentAssistantAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          filterCallCount += 1;
          return {
            ok: true,
            data: [{
              assetId: "asset:agent:cached",
              versionId: "asset:agent:cached:v1",
              name: "Cached Agent",
              kind: "agent",
              status: "published",
              taxonomy: {
                structuralKind: "composite",
                semanticRole: "agent",
                behaviorKind: "autonomous",
              },
              provenance: {
                upstreamAssets: [],
                directUpstreamVersionIds: [],
                directDownstreamVersionIds: [],
              },
              dependencies: [],
              versionHistory: [],
              lineage: {
                upstream: [],
                downstream: [],
              },
            }],
          } as const;
        },
        async searchAssets() {
          throw new Error("not used");
        },
      },
      cacheTtlMs: 1000,
    });

    const request = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow-step:cache",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });

    const first = await provider.query({ request, searchTerm: "" });
    const second = await provider.query({ request, searchTerm: "" });

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(filterCallCount).toBe(1);
  });
});
