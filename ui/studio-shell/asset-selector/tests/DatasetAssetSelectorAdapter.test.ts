import { describe, expect, it } from "bun:test";
import {
  AssetSelectorApplicationValidationService,
  AssetSelectorUsageContexts,
  createDefaultAssetSelectorCapabilityRegistry,
} from "../../../../application/studio-entry/AssetSelectorCapabilityRegistry";
import {
  createDatasetAssetSelectorRequest,
  DatasetAssetSelectorAdapter,
} from "../DatasetAssetSelectorAdapter";

describe("DatasetAssetSelectorAdapter", () => {
  it("builds workflow-input dataset selector requests and maps valid dataset records", async () => {
    const provider = new DatasetAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          return {
            ok: true,
            data: [{
              assetId: "asset:dataset:customers",
              versionId: "asset:dataset:customers:v1",
              name: "Customers",
              kind: "dataset",
              status: "published",
              taxonomy: {
                structuralKind: "atomic",
                semanticRole: "dataset",
                behaviorKind: "none",
              },
              provenance: {
                sourceLabel: "Dataset Studio",
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

    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:dataset:workflow-input",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });

    const validation = new AssetSelectorApplicationValidationService(createDefaultAssetSelectorCapabilityRegistry())
      .validateRequest(request);

    const result = await provider.query({
      request,
      searchTerm: "",
    });

    expect(validation.valid).toBeTrue();
    expect(request.context.usageContext).toBe(AssetSelectorUsageContexts.workflowInput);
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.asset.assetType).toBe("dataset");
    expect(result.items[0]?.title).toBe("Customers");
  });

  it("filters deleted and invalid-role rows from selector results", async () => {
    const provider = new DatasetAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          return {
            ok: true,
            data: [{
              assetId: "asset:dataset:deleted",
              versionId: "asset:dataset:deleted:v1",
              name: "Deleted Dataset",
              kind: "dataset",
              status: "deleted",
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
            }, {
              assetId: "asset:agent:not-dataset",
              versionId: "asset:agent:not-dataset:v1",
              name: "Not Dataset",
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
    });

    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:dataset:workflow-input",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });

    const result = await provider.query({
      request,
      searchTerm: "",
    });

    expect(result.items).toEqual([]);
  });

  it("returns error details when dataset registry queries fail", async () => {
    const provider = new DatasetAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          return {
            ok: false,
            error: {
              message: "registry unavailable",
            },
          } as const;
        },
        async searchAssets() {
          return {
            ok: false,
            error: {
              message: "registry unavailable",
            },
          } as const;
        },
      },
    });

    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:dataset:workflow-input",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });

    const result = await provider.query({
      request,
      searchTerm: "",
    });

    expect(result.items).toEqual([]);
    expect(result.error).toContain("registry unavailable");
  });

  it("reuses short-lived query cache entries to avoid duplicate fetches during rehydration", async () => {
    let filterCallCount = 0;
    const provider = new DatasetAssetSelectorAdapter({
      registryService: {
        async filterAssets() {
          filterCallCount += 1;
          return {
            ok: true,
            data: [{
              assetId: "asset:dataset:cached",
              versionId: "asset:dataset:cached:v1",
              name: "Cached Dataset",
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
      cacheTtlMs: 1000,
    });

    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:dataset:cache",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });

    const first = await provider.query({ request, searchTerm: "" });
    const second = await provider.query({ request, searchTerm: "" });

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(filterCallCount).toBe(1);
  });
});
