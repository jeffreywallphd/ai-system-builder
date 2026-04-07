import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AdminLiteEntryPage from "../AdminLiteEntryPage";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("AdminLiteEntryPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(AdminLiteEntryPage)),
    );

    expect(html).toContain("Admin lite");
    expect(html).toContain("Sign in with an authenticated thin-client workspace session");
    expect(html).toContain("Go to sign in");
  });

  it("renders bounded lightweight workflow cards and desktop-only escalation guidance", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "thin-admin-1",
        username: "thin-admin",
        providerId: "local",
        sessionId: "session-thin-member-1",
        sessionToken: "token-thin-member-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-06T12:00:00.000Z",
        sessionExpiresAt: "2026-04-08T12:00:00.000Z",
        sessionAccessChannel: "thin-client" as const,
        workspaceContext: Object.freeze({
          requestedWorkspaceId: "workspace-alpha",
          resolvedWorkspaceId: "workspace-alpha",
          workspaces: Object.freeze([Object.freeze({
            workspaceId: "workspace-alpha",
            slug: "alpha",
            displayName: "Alpha",
            status: "active",
            visibility: "private",
            effectiveRoles: Object.freeze(["admin"]),
            canAdministrate: true,
            isWorkspaceOwner: false,
          })]),
        }),
        initialCapabilityState: Object.freeze({
          workspaceId: "workspace-alpha",
          effectiveRoles: Object.freeze(["admin"]),
          canAdministrate: true,
          isWorkspaceOwner: false,
        }),
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(AdminLiteEntryPage, { sessionStore }),
      ),
    );

    expect(html).toContain("Thin-client admin-lite workflows");
    expect(html).toContain("Node enrollment review");
    expect(html).toContain("Trusted node inventory");
    expect(html).toContain("Workspace memberships");
    expect(html).toContain("Sharing access review");
    expect(html).toContain("Governance review (thin)");
    expect(html).toContain("Trusted devices");
    expect(html).toContain("Desktop-only administration capabilities");
    expect(html).toContain("Node trust revocation/disable operations");
    expect(html).not.toContain("/settings/security-policy");
    expect(html).toContain("ui-admin-lite-entry__workflow-grid");
  });
});
