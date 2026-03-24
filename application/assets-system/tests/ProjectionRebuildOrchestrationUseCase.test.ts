import { describe, expect, it } from "bun:test";
import { ProjectionRebuildOrchestrationUseCase } from "../ProjectionRebuildOrchestrationUseCase";

describe("ProjectionRebuildOrchestrationUseCase", () => {
  it("replays mixed scopes and verifies when requested", async () => {
    const useCase = new ProjectionRebuildOrchestrationUseCase(
      {
        execute: async () => ({ replayed: true, assetId: "asset-1", versionId: "v1" }),
      } as any,
      {
        execute: async () => ({ publishedEdgeCount: 1, publishedTransformationCount: 0 }),
      } as any,
      {
        execute: async (params: { assetId: string }) => ({ assetId: params.assetId, matched: true, projectionSummary: { edgeCount: 1, scopedVersionCount: 1 }, checks: [] }),
      } as any,
    );

    const result = await useCase.execute({
      verifyAfterReplay: true,
      scopes: [
        { scopeType: "entity", entityType: "workflow-definition", entityId: "wf-1", versionId: "v1" },
        { scopeType: "asset", assetId: "asset-2", versionIdsInScope: ["v2"] },
      ],
    });

    expect(result.totalScopes).toBe(2);
    expect(result.replayedScopes).toBe(2);
    expect(result.verifiedScopes).toBe(2);
  });
});
