import { describe, expect, it } from "bun:test";
import {
  ContextualRecommendationService,
  ContextualRecommendationSurfaces,
  ContextualRecommendationTypes,
} from "../ContextualRecommendations";

describe("ContextualRecommendationService", () => {
  const service = new ContextualRecommendationService();

  it("returns bounded build recommendations using intent-friendly labels", () => {
    const recommendations = service.resolve({
      surface: ContextualRecommendationSurfaces.build,
      buildFlowSessionId: "build-flow-1",
    });

    expect(recommendations.length).toBeLessThanOrEqual(4);
    expect(recommendations.map((entry) => entry.type)).toContain(ContextualRecommendationTypes.continueBuild);
    expect(recommendations.some((entry) => entry.label.toLowerCase().includes("taxonomy"))).toBeFalse();
    expect(recommendations.some((entry) => entry.label.toLowerCase().includes("studio"))).toBeFalse();
    expect(recommendations[0]?.action.launchPath).toContain("buildFlowSessionId=build-flow-1");
  });

  it("returns asset-detail recommendations through existing action abstractions", () => {
    const recommendations = service.resolve({
      surface: ContextualRecommendationSurfaces.assetDetail,
      relatedAssetIds: ["asset:related:1"],
      assetActionContext: {
        source: "detail",
        asset: {
          assetId: "asset:workflow:1",
          versionId: "asset:workflow:1:v1",
          taxonomy: {
            structuralKind: "composite",
            semanticRole: "workflow",
            behaviorKind: "deterministic",
          },
        },
      },
    });

    expect(recommendations.map((entry) => entry.type)).toContain(ContextualRecommendationTypes.runOrTest);
    expect(recommendations.map((entry) => entry.type)).toContain(ContextualRecommendationTypes.addToSystem);
    expect(recommendations.some((entry) => entry.action.launchPath.includes("entryMode=intent"))).toBeTrue();
    expect(recommendations.some((entry) => entry.action.launchPath.includes("context=asset"))).toBeTrue();
    expect(recommendations.some((entry) => entry.action.launchPath.includes("asset%3Arelated%3A1"))).toBeTrue();
  });

  it("differs by run context and remains deterministic", () => {
    const recommendations = service.resolve({
      surface: ContextualRecommendationSurfaces.run,
      runContextKind: "asset",
      assetActionContext: {
        source: "detail",
        asset: {
          assetId: "asset:model:1",
          taxonomy: undefined,
        },
      },
    });

    expect(recommendations.length).toBe(3);
    expect(recommendations[0]?.label).toBe("Continue in Build");
    expect(recommendations[1]?.action.launchPath).toContain("asset%3Amodel%3A1");
    expect(recommendations[2]?.label).toBe("Find related assets");
  });
});
