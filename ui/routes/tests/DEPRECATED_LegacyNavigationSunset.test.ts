import { describe, expect, it } from "bun:test";
import { IntentNavigationFeatureFlag } from "../../features/IntentNavigationFeatureFlag";
import { LegacyNavigationFeatureFlag } from "../../features/DEPRECATED_LegacyNavigationFeatureFlag";
import { ROUTE_PATHS } from "../RouteConfig";
import { NavigationMigrationService } from "../DEPRECATED_LegacyNavigationSunset";

describe("NavigationMigrationService", () => {
  it("hides legacy navigation entries when in sunset mode", () => {
    const service = new NavigationMigrationService({
      intentNavigationFlag: new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true" } }),
      legacyNavigationFlag: new LegacyNavigationFeatureFlag({ env: { VITE_FEATURE_LEGACY_NAVIGATION: "sunset" } }),
    });

    expect(service.shouldShowNavigationRoute("workflows")).toBeFalse();
    expect(service.shouldShowNavigationRoute("tools")).toBeFalse();
    expect(service.shouldShowNavigationRoute("settings")).toBeTrue();
  });

  it("redirects representative legacy entry routes to canonical shell destinations", () => {
    const service = new NavigationMigrationService({
      intentNavigationFlag: new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true" } }),
      legacyNavigationFlag: new LegacyNavigationFeatureFlag({ env: { VITE_FEATURE_LEGACY_NAVIGATION: "sunset" } }),
    });

    expect(service.resolvePathRedirect("/create")).toBe(ROUTE_PATHS.build);
    expect(service.resolvePathRedirect("/compose")).toBe(ROUTE_PATHS.build);
    expect(service.resolvePathRedirect(ROUTE_PATHS.tools)).toBe(ROUTE_PATHS.run);
    expect(service.resolvePathRedirect(ROUTE_PATHS.models)).toBe(ROUTE_PATHS.explore);
  });

  it("preserves bounded compatibility mode for legacy routes", () => {
    const service = new NavigationMigrationService({
      intentNavigationFlag: new IntentNavigationFeatureFlag({ env: { VITE_FEATURE_INTENT_NAVIGATION: "true" } }),
      legacyNavigationFlag: new LegacyNavigationFeatureFlag({ env: { VITE_FEATURE_LEGACY_NAVIGATION: "visible" } }),
    });

    expect(service.shouldShowNavigationRoute("workflows")).toBeTrue();
    expect(service.resolvePathRedirect(ROUTE_PATHS.workflows)).toBeUndefined();
  });
});
