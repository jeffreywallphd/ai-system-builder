import { describe, expect, it } from "bun:test";
import { APP_ROUTES, ROUTE_PATHS } from "../RouteConfig";
import {
  APP_ROUTE_SURFACE_METADATA,
  listCommandPaletteRouteEntries,
  listPrimaryNavigationRouteMetadata,
  listSettingsShortcutRouteMetadata,
  resolveRouteSurfaceMetadataByPath,
} from "../SurfaceRouteMetadataCatalog";
import { UiSurfaceKeys } from "../../shared/navigation/SurfaceNavigationMetadata";

describe("Surface route metadata catalog", () => {
  it("creates canonical metadata records for every app route definition", () => {
    expect(APP_ROUTE_SURFACE_METADATA).toHaveLength(APP_ROUTES.length);
    expect(new Set(APP_ROUTE_SURFACE_METADATA.map((route) => route.key)).size).toBe(APP_ROUTES.length);
  });

  it("groups canonical shell sections through route metadata", () => {
    expect(resolveRouteSurfaceMetadataByPath(ROUTE_PATHS.workflowStudio)?.navigation.shellSection).toBe("build");
    expect(resolveRouteSurfaceMetadataByPath(ROUTE_PATHS.registry)?.navigation.shellSection).toBe("explore");
    expect(resolveRouteSurfaceMetadataByPath(ROUTE_PATHS.tools)?.navigation.shellSection).toBe("run");
  });

  it("derives admin-lite settings shortcuts from structured route metadata", () => {
    const routes = listSettingsShortcutRouteMetadata({ surface: UiSurfaceKeys.adminLite });

    expect(routes.some((route) => route.key === "workspace-admin")).toBeTrue();
    expect(routes.some((route) => route.key === "identity-admin")).toBeTrue();
    expect(routes.some((route) => route.key === "secrets-admin")).toBeTrue();
  });

  it("derives command palette entries from centralized route metadata", () => {
    const entries = listCommandPaletteRouteEntries({ surface: UiSurfaceKeys.desktopOperational });

    expect(entries.map((entry) => entry.label)).toEqual(["Build", "Run", "Explore", "Data", "Manage", "Identity admin"]);
    expect(entries.map((entry) => entry.launchPath)).toContain(ROUTE_PATHS.datasetStudio);
    expect(entries.map((entry) => entry.launchPath)).toContain(ROUTE_PATHS.identityAdmin);
  });

  it("derives primary navigation for desktop operational and excludes admin-only items", () => {
    const entries = listPrimaryNavigationRouteMetadata({ surface: UiSurfaceKeys.desktopOperational });

    expect(entries.some((entry) => entry.key === "build")).toBeTrue();
    expect(entries.some((entry) => entry.key === "workflows")).toBeTrue();
    expect(entries.some((entry) => entry.key === "settings")).toBeFalse();
  });
});
