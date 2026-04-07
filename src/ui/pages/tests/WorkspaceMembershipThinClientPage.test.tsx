import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import WorkspaceMembershipThinClientPage from "../WorkspaceMembershipThinClientPage";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("WorkspaceMembershipThinClientPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(WorkspaceMembershipThinClientPage)),
    );

    expect(html).toContain("Workspace memberships");
    expect(html).toContain("Sign in with an authenticated account");
    expect(html).toContain("Go to sign in");
  });

  it("renders thin membership management layout for authenticated sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "admin-workspace-thin-1",
        username: "workspace-thin-admin",
        providerId: "local",
        sessionId: "session-thin-1",
        sessionToken: "token-thin-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-06T12:00:00.000Z",
        sessionExpiresAt: "2026-04-07T12:00:00.000Z",
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(WorkspaceMembershipThinClientPage, { sessionStore }),
      ),
    );

    expect(html).toContain("Workspace memberships");
    expect(html).toContain("Membership management");
    expect(html).toContain("Invitation status");
  });
});
