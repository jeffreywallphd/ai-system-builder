import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import TrustedDevicesPage, {
  canManageIdentitySessionTarget,
  canManageTrustedDeviceTarget,
} from "../TrustedDevicesPage";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

type TrustedDevicesSession = Parameters<typeof canManageTrustedDeviceTarget>[0];

describe("TrustedDevicesPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(TrustedDevicesPage)),
    );

    expect(html).toContain("Trusted devices");
    expect(html).toContain("Sign in before pairing or revoking trusted devices.");
    expect(html).toContain("Go to sign in");
  });

  it("renders admin-lite ownership boundary messaging for member sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "member-1",
        username: "member",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-06T12:00:00.000Z",
        sessionExpiresAt: "2026-04-08T12:00:00.000Z",
        sessionAccessChannel: "thin-client" as const,
        workspaceContext: Object.freeze({
          requestedWorkspaceId: "workspace-alpha",
          resolvedWorkspaceId: "workspace-alpha",
          workspaces: Object.freeze([
            Object.freeze({
              workspaceId: "workspace-alpha",
              slug: "alpha",
              displayName: "Alpha",
              status: "active" as const,
              visibility: "private" as const,
              effectiveRoles: Object.freeze(["member"] as const),
              canAdministrate: false,
              isWorkspaceOwner: false,
            }),
          ]),
        }),
        initialCapabilityState: Object.freeze({
          workspaceId: "workspace-alpha",
          effectiveRoles: Object.freeze(["member"] as const),
          canAdministrate: false,
          isWorkspaceOwner: false,
        }),
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(TrustedDevicesPage, { sessionStore })),
    );

    expect(html).toContain("Admin-lite boundary");
    expect(html).toContain("only revoke trusted devices and sessions associated with your own identity");
  });
});

describe("TrustedDevicesPage permission helpers", () => {
  const memberSession = Object.freeze({
    userIdentityId: "member-1",
    workspaceContext: Object.freeze({
      requestedWorkspaceId: "workspace-alpha",
      resolvedWorkspaceId: "workspace-alpha",
      workspaces: Object.freeze([
        Object.freeze({
          workspaceId: "workspace-alpha",
          slug: "alpha",
          displayName: "Alpha",
          status: "active" as const,
          visibility: "private" as const,
          effectiveRoles: Object.freeze(["member"] as const),
          canAdministrate: false,
          isWorkspaceOwner: false,
        }),
      ]),
    }),
    initialCapabilityState: Object.freeze({
      workspaceId: "workspace-alpha",
      effectiveRoles: Object.freeze(["member"] as const),
      canAdministrate: false,
      isWorkspaceOwner: false,
    }),
  });

  const adminSession = Object.freeze({
    userIdentityId: "admin-1",
    workspaceContext: Object.freeze({
      requestedWorkspaceId: "workspace-alpha",
      resolvedWorkspaceId: "workspace-alpha",
      workspaces: Object.freeze([
        Object.freeze({
          workspaceId: "workspace-alpha",
          slug: "alpha",
          displayName: "Alpha",
          status: "active" as const,
          visibility: "private" as const,
          effectiveRoles: Object.freeze(["admin"] as const),
          canAdministrate: true,
          isWorkspaceOwner: false,
        }),
      ]),
    }),
    initialCapabilityState: Object.freeze({
      workspaceId: "workspace-alpha",
      effectiveRoles: Object.freeze(["admin"] as const),
      canAdministrate: true,
      isWorkspaceOwner: false,
    }),
  });

  it("allows member sessions only for self-owned trusted devices and sessions", () => {
    expect(canManageTrustedDeviceTarget(memberSession as TrustedDevicesSession, { userIdentityId: "member-1" })).toBeTrue();
    expect(canManageTrustedDeviceTarget(memberSession as TrustedDevicesSession, { userIdentityId: "member-2" })).toBeFalse();
    expect(canManageIdentitySessionTarget(memberSession as TrustedDevicesSession, { userIdentityId: "member-1" })).toBeTrue();
    expect(canManageIdentitySessionTarget(memberSession as TrustedDevicesSession, { userIdentityId: "member-2" })).toBeFalse();
  });

  it("allows admin sessions to manage trusted devices and sessions across identities", () => {
    expect(canManageTrustedDeviceTarget(adminSession as TrustedDevicesSession, { userIdentityId: "member-2" })).toBeTrue();
    expect(canManageIdentitySessionTarget(adminSession as TrustedDevicesSession, { userIdentityId: "member-2" })).toBeTrue();
  });
});
