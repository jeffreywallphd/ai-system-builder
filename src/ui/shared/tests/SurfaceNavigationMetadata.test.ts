import { describe, expect, it } from "bun:test";
import {
  UiSurfaceKeys,
  WorkspaceContextRequirement,
  isRouteAvailableForSurface,
  type SurfaceRouteMetadata,
} from "../navigation/SurfaceNavigationMetadata";

const gatedRoute: SurfaceRouteMetadata<"workspace-admin"> = Object.freeze({
  key: "workspace-admin",
  path: "/settings/workspaces",
  title: "Workspace administration",
  group: "administration",
  navigation: Object.freeze({ showInSettingsNavigation: true }),
  access: Object.freeze({
    eligibleSurfaces: Object.freeze([UiSurfaceKeys.desktopAdmin, UiSurfaceKeys.adminLite]),
    requiredRoles: Object.freeze(["owner", "admin"]),
    requiredCapabilities: Object.freeze(["system.manage"]),
    workspaceContext: WorkspaceContextRequirement.required,
  }),
});

describe("SurfaceNavigationMetadata availability checks", () => {
  it("allows metadata routes when role, capability, surface, and workspace context satisfy access rules", () => {
    expect(isRouteAvailableForSurface(gatedRoute, {
      surface: UiSurfaceKeys.desktopAdmin,
      roleKeys: Object.freeze(["admin"]),
      capabilityKeys: Object.freeze(["system.manage"]),
      hasWorkspaceContext: true,
      strict: true,
    })).toBeTrue();
  });

  it("blocks metadata routes when strict context does not satisfy gating requirements", () => {
    expect(isRouteAvailableForSurface(gatedRoute, {
      surface: UiSurfaceKeys.thinClientOperational,
      roleKeys: Object.freeze(["member"]),
      capabilityKeys: Object.freeze(["system.read"]),
      hasWorkspaceContext: false,
      strict: true,
    })).toBeFalse();
  });
});
