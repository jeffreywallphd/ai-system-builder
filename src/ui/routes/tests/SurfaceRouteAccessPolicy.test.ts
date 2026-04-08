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
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.securityPolicy, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.governanceReview, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.deploymentPolicyAdmin, session, { strict: true }),
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
      isRoutePathAccessibleForSession(ROUTE_PATHS.governanceReviewThin, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.workspaceAdmin, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.identityAdmin, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.securityPolicy, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.deploymentPolicyAdmin, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.governanceReview, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.deploymentPolicyAdmin, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.nodeEnrollmentReview, session, { strict: true }),
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

  it("allows thin admin sessions into approval and thin-governance routes", () => {
    const session = createSession("thin-client", ["admin"]);

    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.nodeEnrollmentReview, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.governanceReviewThin, session, { strict: true }),
    ).toBeTrue();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.securityPolicy, session, { strict: true }),
    ).toBeFalse();
  });

  it("keeps desktop admin routes unavailable without workspace context", () => {
    const session = createSession("desktop", ["admin"], {
      omitWorkspaceContext: true,
      omitInitialWorkspaceId: true,
    });

    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.workspaceAdmin, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.securityPolicy, session, { strict: true }),
    ).toBeFalse();
    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.governanceReview, session, { strict: true }),
    ).toBeFalse();
  });

  it("does not elevate route access from unrelated workspace roles", () => {
    const session = createSession("desktop", ["member"], {
      omitWorkspaceContext: true,
      omitInitialWorkspaceId: true,
      workspaceRoleOverrides: Object.freeze([
        Object.freeze({
          workspaceId: "workspace-alpha",
          slug: "alpha",
          displayName: "Alpha",
          status: "active",
          visibility: "private",
          effectiveRoles: Object.freeze(["owner"]),
          canAdministrate: true,
          isWorkspaceOwner: true,
        }),
        Object.freeze({
          workspaceId: "workspace-beta",
          slug: "beta",
          displayName: "Beta",
          status: "active",
          visibility: "private",
          effectiveRoles: Object.freeze(["member"]),
          canAdministrate: false,
          isWorkspaceOwner: false,
        }),
      ]),
    });

    expect(
      isRoutePathAccessibleForSession(ROUTE_PATHS.identityAdmin, session, { strict: true }),
    ).toBeFalse();
  });
});

function createSession(
  accessChannel: "desktop" | "thin-client",
  roles: ReadonlyArray<"owner" | "admin" | "member" | "viewer">,
  options: {
    readonly omitWorkspaceContext?: boolean;
    readonly omitInitialWorkspaceId?: boolean;
    readonly workspaceRoleOverrides?: NonNullable<IdentityAuthPersistedSession["workspaceContext"]>["workspaces"];
  } = {},
): IdentityAuthPersistedSession {
  const workspaces = options.workspaceRoleOverrides ?? Object.freeze([
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
  ]);

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
    workspaceContext: options.omitWorkspaceContext
      ? undefined
      : Object.freeze({
        requestedWorkspaceId: "workspace-alpha",
        resolvedWorkspaceId: "workspace-alpha",
        workspaces,
      }),
    initialCapabilityState: Object.freeze({
      workspaceId: options.omitInitialWorkspaceId ? undefined : "workspace-alpha",
      effectiveRoles: Object.freeze([...roles]),
      canAdministrate: roles.includes("owner") || roles.includes("admin"),
      isWorkspaceOwner: roles.includes("owner"),
    }),
  });
}
