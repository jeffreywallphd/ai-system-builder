import { describe, expect, it } from "bun:test";
import { buildStudioHandoffQuery, resolveStudioRouteFromAsset } from "../StudioRouteMapping";
import { ROUTE_PATHS } from "../RouteConfig";

describe("StudioRouteMapping", () => {
  it("maps semantic roles to existing studio routes", () => {
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } })).toBe(ROUTE_PATHS.modelStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" } })).toBe(ROUTE_PATHS.workflowStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } })).toBe(ROUTE_PATHS.systemStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "system", semanticRole: "app-template", behaviorKind: "conditional" } })).toBe(ROUTE_PATHS.systemStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: undefined })).toBeUndefined();
  });

  it("includes asset handoff context for studio deep links", () => {
    const query = new URLSearchParams(buildStudioHandoffQuery(
      { assetId: "asset:workflow", versionId: "asset:workflow:v2" },
      {
        handoff: "system-studio",
        registryContext: "keyword=systems",
        parentAssetId: "system:root",
        parentVersionId: "system:root:v1",
        selectedComponent: "system:child",
      },
    ));
    expect(query.get("assetId")).toBe("asset:workflow");
    expect(query.get("versionId")).toBe("asset:workflow:v2");
    expect(query.get("handoff")).toBe("system-studio");
    expect(query.get("registryContext")).toBe("keyword=systems");
    expect(query.get("parentAssetId")).toBe("system:root");
    expect(query.get("parentVersionId")).toBe("system:root:v1");
    expect(query.get("selectedComponent")).toBe("system:child");
  });
});
