import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import WorkspaceAdministrationPage, { parseInvitationRoleCsv } from "../WorkspaceAdministrationPage";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("WorkspaceAdministrationPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(WorkspaceAdministrationPage)),
    );

    expect(html).toContain("Workspace administration");
    expect(html).toContain("Sign in with an authenticated admin-capable account");
    expect(html).toContain("Go to sign in");
  });

  it("renders membership administration surface for authenticated sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "admin-workspace-1",
        username: "workspace-admin",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
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
        React.createElement(WorkspaceAdministrationPage, { sessionStore }),
      ),
    );

    expect(html).toContain("Workspace administration");
    expect(html).toContain("Workspace context");
    expect(html).toContain("Membership administration");
    expect(html).toContain("Role assignment state");
  });
});

describe("parseInvitationRoleCsv", () => {
  it("deduplicates and normalizes supported roles", () => {
    expect(parseInvitationRoleCsv(" admin,member,admin ")).toEqual({
      ok: true,
      roles: ["admin", "member"],
    });
  });

  it("rejects unsupported role values", () => {
    expect(parseInvitationRoleCsv("member,owner")).toEqual({
      ok: false,
      message: "Unsupported role values: owner.",
    });
  });
});
