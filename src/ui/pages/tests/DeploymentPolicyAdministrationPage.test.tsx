import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import DeploymentPolicyAdministrationPage from "../DeploymentPolicyAdministrationPage";
import type { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";

describe("DeploymentPolicyAdministrationPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(DeploymentPolicyAdministrationPage)),
    );

    expect(html).toContain("Deployment profile and policy state");
    expect(html).toContain("Sign in with an authenticated administrative session");
    expect(html).toContain("Go to sign in");
  });

  it("renders inspection controls for owner/admin sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "admin-1",
        username: "admin-user",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-07T09:00:00.000Z",
        sessionExpiresAt: "2026-04-07T21:00:00.000Z",
        workspaceContext: Object.freeze({
          resolvedWorkspaceId: "workspace-alpha",
          requestedWorkspaceId: "workspace-alpha",
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
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(DeploymentPolicyAdministrationPage, { sessionStore }),
      ),
    );

    expect(html).toContain("Inspection scope");
    expect(html).toContain("Profile selector");
    expect(html).toContain("active (resolved)");
    expect(html).toContain("Desktop administration shell");
  });
});
