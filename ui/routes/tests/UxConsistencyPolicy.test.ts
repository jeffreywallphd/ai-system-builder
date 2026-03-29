import { describe, expect, it } from "bun:test";
import { LegacyNavigationCompatibilityModes } from "../../features/LegacyNavigationFeatureFlag";
import { LegacyUxCleanupPlanner } from "../LegacyNavigationSunset";
import { UxConsistencyPolicy, UxConsistencyRecentStateProbe } from "../UxConsistencyPolicy";

describe("UxConsistencyPolicy", () => {
  it("passes representative intent UX consistency audit checks", () => {
    const result = new UxConsistencyPolicy().evaluate();

    expect(result.passed).toBeTrue();
    expect(result.evaluatedRuleCount).toBeGreaterThanOrEqual(5);
    expect(result.issues).toHaveLength(0);
  });

  it("keeps recent/favorites labels aligned to Build intent vocabulary", () => {
    const state = new UxConsistencyRecentStateProbe().recordRepresentativeState();
    const buildFlowRecent = state.recents.find((entry) => entry.id.startsWith("build-flow:create-ai-assistant"));

    expect(buildFlowRecent?.title).toBe("Create an AI assistant");
  });
});

describe("LegacyUxCleanupPlanner", () => {
  it("projects deprecated route policy decisions from legacy navigation sunset controls", () => {
    const plan = new LegacyUxCleanupPlanner(LegacyNavigationCompatibilityModes.sunset).createPlan();

    expect(plan.deprecatedRoutes.some((route) => route.routePath === "/create" && route.state === "redirect" && route.canonicalPath === "/build")).toBeTrue();
    expect(plan.deprecatedRoutes.some((route) => route.routePath === "/tools" && route.canonicalPath === "/run")).toBeTrue();
    expect(plan.deprecatedRoutes.some((route) => route.routePath === "/models" && route.canonicalPath === "/explore")).toBeTrue();
  });
});
