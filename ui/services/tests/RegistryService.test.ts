import { afterEach, describe, expect, it } from "bun:test";
import { RegistryService } from "../RegistryService";

describe("RegistryService", () => {
  const previousBridge = typeof window === "undefined" ? undefined : window.aiLoomDesktop;

  afterEach(() => {
    if (typeof window !== "undefined") {
      window.aiLoomDesktop = previousBridge;
    }
  });

  it("loads filtered registry assets through desktop bridge", async () => {
    if (typeof window === "undefined") {
      return;
    }

    window.aiLoomDesktop = {
      ...(previousBridge ?? {}),
      registry: {
        listAssets: async () => JSON.stringify({ ok: true, data: [] }),
        filterAssets: async (filtersJson: string) => {
          const parsed = JSON.parse(filtersJson) as { structuralKinds?: ReadonlyArray<string> };
          return JSON.stringify({
            ok: true,
            data: [{
              assetId: "asset:workflow",
              name: "Workflow",
              kind: "workflow-definition",
              status: "published",
              versionId: "asset:workflow:v1",
              taxonomy: {
                structuralKind: parsed.structuralKinds?.[0] ?? "composite",
                semanticRole: "workflow",
                behaviorKind: "deterministic",
              },
              provenance: {
                upstreamAssets: [],
                directUpstreamVersionIds: [],
                directDownstreamVersionIds: [],
              },
              dependencies: [],
            }],
          });
        },
        getAssetDetail: async () => JSON.stringify({ ok: true, data: { assetId: "asset:workflow" } }),
        getDependencies: async () => JSON.stringify({ ok: true, data: { nodes: [], edges: [] } }),
        getDependents: async () => JSON.stringify({ ok: true, data: { nodes: [], edges: [] } }),
        traverseUpstream: async () => JSON.stringify({ ok: true, data: { rootVersionId: "", direction: "upstream", maxDepth: 1, graph: { nodes: [], edges: [] }, levels: [] } }),
        traverseDownstream: async () => JSON.stringify({ ok: true, data: { rootVersionId: "", direction: "downstream", maxDepth: 1, graph: { nodes: [], edges: [] }, levels: [] } }),
      },
    } as any;

    const service = new RegistryService();
    const result = await service.filterAssets({ structuralKinds: ["system"] });

    expect(result.ok).toBeTrue();
    expect(result.data?.[0]?.taxonomy?.structuralKind).toBe("system");
  });
});
