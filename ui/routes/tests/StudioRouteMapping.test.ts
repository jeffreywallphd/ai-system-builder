import { describe, expect, it } from "bun:test";
import {
  buildStudioHandoffQuery,
  resolveStudioRouteFromAsset,
  StudioEntryResolver,
  StudioEntryService,
} from "../StudioRouteMapping";
import { ROUTE_PATHS } from "../RouteConfig";

describe("StudioRouteMapping", () => {
  it("maps semantic roles to existing studio routes", () => {
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" } })).toBe(ROUTE_PATHS.modelStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" } })).toBe(ROUTE_PATHS.workflowStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" } })).toBe(ROUTE_PATHS.systemStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: { structuralKind: "system", semanticRole: "app-template", behaviorKind: "conditional" } })).toBe(ROUTE_PATHS.systemStudio);
    expect(resolveStudioRouteFromAsset({ taxonomy: undefined })).toBeUndefined();
  });

  it("builds studio entry routes through a shared entry service for asset and blank flows", () => {
    const service = new StudioEntryService();

    const blank = service.buildStudioRoute({ requestedStudioType: "workflow-studio" });
    expect(blank).toBe(ROUTE_PATHS.workflowStudio);

    const asset = service.buildStudioRoute({
      requestedRole: "model",
      mode: "asset",
      asset: {
        assetId: "asset:model",
        versionId: "asset:model:v2",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      },
    });
    expect(asset).toContain(ROUTE_PATHS.modelStudio);
    const query = new URLSearchParams(asset?.split("?")[1] ?? "");
    expect(query.get("assetId")).toBe("asset:model");
    expect(query.get("versionId")).toBe("asset:model:v2");
    expect(query.get("entryMode")).toBe("asset");
    expect(query.get("initSource")).toBe("asset");
  });

  it("resolves system studio through the same entry abstraction", () => {
    const resolver = new StudioEntryResolver();
    const resolution = resolver.resolve({
      requestedRole: "system",
      mode: "intent",
      intent: {
        key: "compose-system",
        label: "Compose a system",
      },
      prefill: { values: { selectedComponent: "asset:child-system" } },
    });

    expect(resolution?.entryPoint.routePath).toBe(ROUTE_PATHS.systemStudio);
    expect(resolution?.entryPoint.studioType).toBe("system-studio");
    expect(resolution?.initializationPayload.initialization.mode).toBe("intent");
    expect(resolution?.initializationPayload.initialization.context.prefill?.values).toEqual({ selectedComponent: "asset:child-system" });
  });

  it("includes asset handoff context for studio deep links", () => {
    const query = new URLSearchParams(buildStudioHandoffQuery(
      {
        assetId: "asset:workflow",
        versionId: "asset:workflow:v2",
        taxonomy: { structuralKind: "composite", semanticRole: "workflow", behaviorKind: "deterministic" },
      },
      {
        source: "system-studio",
        handoff: "system-studio",
        registryContext: "keyword=systems",
        parentAssetId: "system:root",
        parentVersionId: "system:root:v1",
        selectedComponent: "system:child",
      },
    ));
    expect(query.get("assetId")).toBe("asset:workflow");
    expect(query.get("versionId")).toBe("asset:workflow:v2");
    expect(query.get("entryMode")).toBe("asset");
    expect(query.get("initSource")).toBe("asset");
    expect(query.get("handoff")).toBe("system-studio");
    expect(query.get("registryContext")).toBe("keyword=systems");
    expect(query.get("parentAssetId")).toBe("system:root");
    expect(query.get("parentVersionId")).toBe("system:root:v1");
    expect(query.get("selectedComponent")).toBe("system:child");
  });
});
