import { describe, expect, it } from "bun:test";
import { createAssetSelectorRequest, AssetSelectorSelectionModes, AssetSelectorSelectionTypes } from "@domain/studio-shell/AssetSelectorContract";
import { RegistryAssetSelectorDataProvider } from "../RegistryAssetSelectorDataProvider";

describe("RegistryAssetSelectorDataProvider", () => {
  it("maps registry records into generic selector result items", async () => {
    const provider = new RegistryAssetSelectorDataProvider({
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
    const request = createAssetSelectorRequest({
      requestId: "selector:test",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.multiSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: {
        minSelections: 0,
      },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs",
      },
    });

    const result = await provider.query({
      request,
      searchTerm: "",
    });

    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.asset.assetType).toBe("dataset");
    expect(result.items[0]?.title).toBe("Customers");
  });

  it("returns an error payload when registry calls fail", async () => {
    const provider = new RegistryAssetSelectorDataProvider({
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
    const request = createAssetSelectorRequest({
      requestId: "selector:test",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.multiSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: {
        minSelections: 0,
      },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs",
      },
    });

    const result = await provider.query({
      request,
      searchTerm: "",
    });

    expect(result.items).toEqual([]);
    expect(result.error).toContain("bridge unavailable");
  });
});

