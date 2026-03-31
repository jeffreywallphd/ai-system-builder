import { describe, expect, it } from "bun:test";
import type { ExploreSearchResult } from "../../../application/asset-registry/ExploreAssetQueryService";
import { PersistedWorkflowEntryService } from "../PersistedWorkflowEntryService";

describe("PersistedWorkflowEntryService", () => {
  it("lists persisted workflow entries and builds Workflow Studio and Run paths", async () => {
    const service = new PersistedWorkflowEntryService(
      {
        async searchExploreAssets(): Promise<{ ok: boolean; data: ExploreSearchResult }> {
          return {
            ok: true,
            data: {
              query: {},
              totalCount: 1,
              facets: [],
              assets: [{
                id: { assetId: "workflow:persisted:1", versionId: "v1" },
                displayName: "Persisted Workflow 1",
                assetKind: "composite",
                primaryLabel: "workflow",
                status: "draft",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
                metadata: {
                  sourceType: "workflow-persistence",
                  summary: "Saved for reuse",
                  dependencyCount: 0,
                  versionCount: 1,
                },
              }],
            },
          };
        },
      } as unknown as ConstructorParameters<typeof PersistedWorkflowEntryService>[0],
    );

    const result = await service.listEntries(3);
    expect(result.ok).toBeTrue();
    expect(result.data?.length).toBe(1);
    const entry = result.data![0]!;
    expect(service.buildWorkflowStudioOpenPath(entry)).toContain("workflowEntry=resume-draft");
    expect(service.buildRunWorkflowPath(entry)).toContain("context=workflow");
    expect(service.buildRunWorkflowPath(entry)).toContain("workflowId=workflow%3Apersisted%3A1");
  });

  it("fails safely when explore retrieval fails", async () => {
    const service = new PersistedWorkflowEntryService(
      {
        async searchExploreAssets() {
          return {
            ok: false,
            error: { code: "internal", message: "downstream unavailable" },
          };
        },
      } as unknown as ConstructorParameters<typeof PersistedWorkflowEntryService>[0],
    );

    const result = await service.listEntries();
    expect(result.ok).toBeFalse();
    expect(result.error).toBe("downstream unavailable");
  });
});
