import { describe, expect, it } from "bun:test";
import { ROUTE_PATHS } from "../RouteConfig";
import {
  isRoutePathAccessibleForSession,
  resolveNavigationAvailabilityContextForSession,
} from "../SurfaceRouteAccessPolicy";
import type { IdentityAuthPersistedSession } from "../../shared/identity/IdentityAuthSessionStore";
import { UiSurfaceKeys } from "../../shared/navigation/SurfaceNavigationMetadata";

describe("SurfaceRouteAccessPolicy", () => {
  it("denies desktop admin shell route when session is missing", () => {
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.adminShell, undefined, { strict: true }),
    ).toBeFalse();
  });

  it("allows desktop administrative routes for owner/admin sessions", () => {
    const session = createSession("desktop", ["owner"]);

    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.adminShell, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.identityAdmin, session, { strict: true }),
    ).toBeTrue();
  });

  it("allows only lightweight admin-lite routes for thin member sessions", () => {
    const session = createSession("thin-client", ["member"]);

    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.adminLiteShell, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.workspaceThinMembership, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.trustedDevices, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.workspaceAdmin, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.identityAdmin, session, { strict: true }),
    ).toBeFalse();
  });

  it("builds strict navigation context with derived role and capability keys", () => {
    const session = createSession("desktop", ["admin"]);
    const context = resolveNavigationAvailabilityContextForSession(session, {
      preferredSurface: UiSurfaceKeys.desktopAdmin,
      strict: true,
    });

    expect(context.surface).toBe(UiSurfaceKeys.desktopAdmin);
    expect(context.strict).toBeTrue();
    expect(context.roleKeys).toContain("admin");
    expect(context.capabilityKeys).toContain("system.manage");
  });
});

function createSession(
  accessChannel: "desktop" | "thin-client",
  roles: ReadonlyArray<"owner" | "admin" | "member" | "viewer">,
): IdentityAuthPersistedSession {
  return Object.freeze({
    userIdentityId: "user-1",
    username: "operator",
    providerId: "local",
    sessionId: "session-1",
    sessionToken: "token-1",
    sessionTokenType: "Bearer",
    sessionIssuedAt: "2026-04-07T12:00:00.000Z",
    sessionExpiresAt: "2026-04-08T12:00:00.000Z",
    sessionAccessChannel: accessChannel,
    workspaceContext: Object.freeze({
      requestedWorkspaceId: "workspace-alpha",
      resolvedWorkspaceId: "workspace-alpha",
      workspaces: Object.freeze([
        Object.freeze({
          workspaceId: "workspace-alpha",
          slug: "alpha",
          displayName: "Alpha",
          status: "active",
          visibility: "private",
          effectiveRoles: Object.freeze([...roles]),
          canAdministrate: roles.includes("owner") || roles.includes("admin"),
          isWorkspaceOwner: roles.includes("owner"),
        }),
      ]),
    }),
    initialCapabilityState: Object.freeze({
      workspaceId: "workspace-alpha",
      effectiveRoles: Object.freeze([...roles]),
      canAdministrate: roles.includes("owner") || roles.includes("admin"),
      isWorkspaceOwner: roles.includes("owner"),
    }),
  });
}
