import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AuthorizationSharingManagementPage from "../AuthorizationSharingManagementPage";
import type { AuthorizationManagementService } from "../../services/AuthorizationManagementService";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("AuthorizationSharingManagementPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(AuthorizationSharingManagementPage)),
    );

    expect(html).toContain("Resource sharing and visibility");
    expect(html).toContain("Sign in with an authenticated account");
    expect(html).toContain("Go to sign in");
  });

  it("renders sharing management panel and compact-web link for authenticated sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "user-owner",
        username: "owner",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-05T11:00:00.000Z",
        sessionExpiresAt: "2026-04-05T23:00:00.000Z",
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const service = {} as AuthorizationManagementService;
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/settings/sharing?resourceFamily=asset&resourceType=asset+type&resourceId=asset%3A1&workspaceId=workspace%3A1"] },
        React.createElement(AuthorizationSharingManagementPage, {
          sessionStore,
          service,
        }),
      ),
    );

    expect(html).toContain("Resource sharing and visibility");
    expect(html).toContain("Resource selection");
    expect(html).toContain("Visibility and policy");
    expect(html).toContain("Current sharing grants");
    expect(html).toContain("Add sharing grant");
    expect(html).toContain("Permission feedback");
    expect(html).toContain("/settings/sharing/thin?resourceFamily=asset&amp;resourceType=asset+type&amp;resourceId=asset%3A1&amp;workspaceId=workspace%3A1");
  });
});

