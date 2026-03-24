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
        execute: async (params: { assetId: string; versionIdsInScope?: ReadonlyArray<string> }) => ({
          assetId: params.assetId,
          matched: true,
          trust: { state: "trusted", explanation: "ok", recommendedActions: [] },
          projectionSummary: { edgeCount: 1, scopedVersionCount: params.versionIdsInScope?.length ?? 1 },
          mismatches: [],
          checks: [],
        }),
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

  it("can verify before replay and target mismatched versions only", async () => {
    const replayCalls: Array<ReadonlyArray<string> | undefined> = [];
    const useCase = new ProjectionRebuildOrchestrationUseCase(
      { execute: async () => ({ replayed: true, assetId: "asset-1", versionId: "v1" }) } as any,
      {
        execute: async (params: { versionIds?: ReadonlyArray<string> }) => {
          replayCalls.push(params.versionIds);
          return { publishedEdgeCount: 1, publishedTransformationCount: 0 };
        },
      } as any,
      {
        execute: async () => ({
          assetId: "asset-2",
          matched: false,
          trust: { state: "mismatch-detected", explanation: "mismatch", recommendedActions: ["repair"] },
          projectionSummary: { edgeCount: 1, scopedVersionCount: 2 },
          mismatches: [{ versionId: "v2", missingUpstreamVersionIds: [], unexpectedUpstreamVersionIds: [], missingDownstreamVersionIds: ["v3"], unexpectedDownstreamVersionIds: [] }],
          checks: [],
        }),
      } as any,
    );

    await useCase.execute({
      verifyBeforeReplay: true,
      replayMismatchedVersionsOnly: true,
      scopes: [{ scopeType: "asset", assetId: "asset-2", versionIdsInScope: ["v1", "v2"] }],
    });

    expect(replayCalls[0]).toEqual(["v2"]);
  });
});
