import { describe, expect, it } from "bun:test";
import { LoadCanonicalAssetManagementSnapshotUseCase } from "../LoadCanonicalAssetManagementSnapshotUseCase";

describe("LoadCanonicalAssetManagementSnapshotUseCase", () => {
  it("builds canonical management snapshot with lifecycle and projection health", async () => {
    const useCase = new LoadCanonicalAssetManagementSnapshotUseCase(
      {
        execute: async () => ({
          assetId: "asset-1",
          name: "Asset",
          kind: "workflow-definition",
          status: "available",
          latestVersion: { versionId: "v2" },
          versionCount: 2,
          transformationCount: 1,
          lineageEdgeCount: 1,
        }),
      } as any,
      {
        execute: async () => ([
          { versionId: "v2", parentVersionId: "v1", createdAt: new Date("2026-03-24T00:00:00.000Z"), versionLabel: "v2" },
          { versionId: "v1", createdAt: new Date("2026-03-23T00:00:00.000Z"), versionLabel: "v1" },
        ]),
      } as any,
      {
        execute: async ({ versionId }: { versionId: string }) => ({
          versionId,
          state: versionId === "v1" ? "stale" : "healthy",
          lineageConfidence: "exact",
          lifecycle: { source: "recomputed", computedAt: new Date(), reason: "recomputed" },
          reasons: ["reason"],
          impactedByUpstreamVersionIds: [],
          staleBecauseUpstreamAdvanced: [],
          nextActions: ["action"],
        }),
      } as any,
      {
        execute: async () => ({ versionId: "v2", explanation: "produced", evidence: ["edge"] }),
      } as any,
      {
        execute: async () => ({
          matched: false,
          trust: { state: "mismatch-detected", explanation: "mismatch", recommendedActions: ["repair"] },
          mismatches: [{ versionId: "v1" }],
          checks: [
            { code: "EDGE_COUNT", matched: false, message: "missing" },
          ],
          projectionSummary: { edgeCount: 0, scopedVersionCount: 2 },
        }),
      } as any,
    );

    const snapshot = await useCase.execute({ assetId: "asset-1", includeProjectionHealth: true, versionIdsInProjectionScope: ["v1", "v2"] });
    expect(snapshot?.asset.assetId).toBe("asset-1");
    expect(snapshot?.versions).toHaveLength(2);
    expect(snapshot?.dependencyLifecycleSummary.stale).toBe(1);
    expect(snapshot?.operationalSummary.status).toBe("attention-needed");
    expect(snapshot?.projectionHealth?.matched).toBeFalse();
    expect(snapshot?.projectionHealth?.trustState).toBe("mismatch-detected");
    expect(snapshot?.projectionHealth?.mismatchedVersionIds).toEqual(["v1"]);
    expect(snapshot?.projectionHealth?.failedChecks[0]).toContain("EDGE_COUNT");
  });

  it("returns undefined when canonical asset detail is missing", async () => {
    const snapshot = await new LoadCanonicalAssetManagementSnapshotUseCase(
      { execute: async () => undefined } as any,
      { execute: async () => [] } as any,
      { execute: async () => ({}) } as any,
      { execute: async () => ({}) } as any,
    ).execute({ assetId: "missing" });

    expect(snapshot).toBeUndefined();
  });
});
