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

  it("keeps only persisted workflow rows with supported draft/saved statuses", async () => {
    const service = new PersistedWorkflowEntryService(
      {
        async searchExploreAssets(): Promise<{ ok: boolean; data: ExploreSearchResult }> {
          return {
            ok: true,
            data: {
              query: {},
              totalCount: 5,
              facets: [],
              assets: [{
                id: { assetId: "workflow:persisted:saved", versionId: "v2" },
                displayName: "Saved persisted workflow",
                assetKind: "composite",
                primaryLabel: "workflow",
                status: "saved",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
                metadata: {
                  sourceType: "workflow-persistence",
                  summary: "Saved and reusable",
                  dependencyCount: 0,
                  versionCount: 2,
                },
              }, {
                id: { assetId: "workflow:transient:running", versionId: "v2" },
                displayName: "Running workflow",
                assetKind: "composite",
                primaryLabel: "workflow",
                status: "running",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
                metadata: {
                  sourceType: "workflow-persistence",
                  summary: "Not a persisted library status",
                  dependencyCount: 0,
                  versionCount: 2,
                },
              }, {
                id: { assetId: "workflow:seeded:library", versionId: "v1" },
                displayName: "Seeded workflow",
                assetKind: "composite",
                primaryLabel: "workflow",
                status: "saved",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
                metadata: {
                  sourceType: "seed",
                  summary: "Not persisted workflow source",
                  dependencyCount: 0,
                  versionCount: 1,
                },
              }, {
                id: { assetId: "tool:persisted:1", versionId: "v1" },
                displayName: "Persisted tool",
                assetKind: "atomic",
                primaryLabel: "tool",
                status: "saved",
                taxonomy: { structuralKind: "atomic", semanticRole: "tool", behaviorKind: "conditional" },
                metadata: {
                  sourceType: "workflow-persistence",
                  summary: "Not a workflow semantic role",
                  dependencyCount: 0,
                  versionCount: 1,
                },
              }, {
                id: { assetId: "workflow:persisted:draft", versionId: "v1" },
                displayName: "Draft persisted workflow",
                assetKind: "composite",
                primaryLabel: "workflow",
                status: "draft",
                taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "iterative" },
                metadata: {
                  sourceType: "workflow-persistence",
                  summary: "Draft and reusable",
                  dependencyCount: 1,
                  versionCount: 1,
                },
              }],
            },
          };
        },
      } as unknown as ConstructorParameters<typeof PersistedWorkflowEntryService>[0],
    );

    const result = await service.listEntries();
    expect(result.ok).toBeTrue();
    expect(result.data?.map((entry) => entry.workflowId)).toEqual([
      "workflow:persisted:saved",
      "workflow:persisted:draft",
    ]);
    expect(service.buildWorkflowStudioOpenPath(result.data![0]!)).toContain("workflowEntry=open-existing");
    expect(service.buildWorkflowStudioOpenPath(result.data![1]!)).toContain("workflowEntry=resume-draft");
    expect(service.buildRunWorkflowPath(result.data![0]!)).toContain("workflowStatus=saved");
    expect(service.buildRunWorkflowPath(result.data![1]!)).toContain("workflowStatus=draft");
  });

  it("fails safely when explore retrieval throws unexpectedly", async () => {
    const service = new PersistedWorkflowEntryService(
      {
        async searchExploreAssets() {
          throw new Error("unreachable registry");
        },
      } as unknown as ConstructorParameters<typeof PersistedWorkflowEntryService>[0],
    );

    const result = await service.listEntries();
    expect(result.ok).toBeFalse();
    expect(result.error).toBe("Failed to load persisted workflows.");
  });
});
