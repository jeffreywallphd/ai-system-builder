import { afterEach, describe, expect, it } from "bun:test";
import { RegistryService } from "../RegistryService";
import { StudioShellService } from "../StudioShellService";
import {
  WorkflowDraftTriggerKinds,
  WorkflowDraftTriggerTypes,
  createEmptyWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../src/domain/workflow-studio/WorkflowStudioDomain";

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
        searchAssets: async () => JSON.stringify({ ok: true, data: [] }),
        listExploreAssets: async () => JSON.stringify({ ok: true, data: { assets: [], totalCount: 0, availableKinds: [] } }),
        searchExploreAssets: async () => JSON.stringify({ ok: true, data: { assets: [], totalCount: 0, facets: [], query: {} } }),
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

  it("uses browser fallback backend when desktop registry bridge is unavailable", async () => {
    if (typeof window === "undefined") {
      return;
    }

    window.aiLoomDesktop = {
      ...(previousBridge ?? {}),
      registry: undefined,
    } as any;

    const service = new RegistryService();
    const result = await service.searchExploreAssets({
      keyword: "workflow",
      limit: 25,
    });

    expect(result.ok).toBeTrue();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data?.assets)).toBeTrue();
    expect(Array.isArray(result.data?.facets)).toBeTrue();
  });

  it("shares browser fallback workflow persistence with studio shell flows for explore listings", async () => {
    if (typeof window === "undefined") {
      return;
    }

    window.aiLoomDesktop = {
      ...(previousBridge ?? {}),
      registry: undefined,
      studioShell: undefined,
    } as any;

    const studioService = new StudioShellService();
    const initialized = await studioService.initializeStudio("studio-workflows", "Workflow Studio");
    expect(initialized.ok).toBeTrue();
    expect(initialized.data?.activeSessionId).toBeDefined();

    const created = await studioService.createDraft({
      studioId: "studio-workflows",
      sessionId: initialized.data!.activeSessionId!,
      content: serializeWorkflowDraft({
        ...createEmptyWorkflowDraft(),
        triggers: [{
          id: "trigger-manual",
          kind: WorkflowDraftTriggerKinds.user,
          type: WorkflowDraftTriggerTypes.userManual,
          config: {},
        }],
      }),
      metadata: {
        title: "Fallback workflow",
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "deterministic",
        },
        tags: [],
      },
      dependencies: [],
    });
    expect(created.ok).toBeTrue();

    const registryService = new RegistryService();
    const listed = await registryService.searchExploreAssets({
      filters: {
        semanticRoles: ["workflow"],
        sourceTypes: ["workflow-persistence"],
      },
      limit: 25,
    });
    expect(listed.ok).toBeTrue();
    expect((listed.data?.assets.length ?? 0) > 0).toBeTrue();
    expect(listed.data?.assets.some((asset) => asset.displayName === "Fallback workflow")).toBeTrue();
  });
});
