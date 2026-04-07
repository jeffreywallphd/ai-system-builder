import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AuthorizationSharingThinClientPage from "../AuthorizationSharingThinClientPage";
import type { AuthorizationManagementService } from "../../services/AuthorizationManagementService";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("AuthorizationSharingThinClientPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(AuthorizationSharingThinClientPage)),
    );

    expect(html).toContain("Sharing access review");
    expect(html).toContain("Sign in with an authenticated account");
    expect(html).toContain("Go to sign in");
  });

  it("renders compact sharing panel and desktop-link handoff for authenticated sessions", () => {
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
        { initialEntries: ["/settings/sharing/thin?resourceFamily=workflow&resourceType=workflow+type&resourceId=wf%3A2&workspaceId=workspace%3A1"] },
        React.createElement(AuthorizationSharingThinClientPage, {
          sessionStore,
          service,
        }),
      ),
    );

    expect(html).toContain("Sharing access review");
    expect(html).toContain("Resource selection");
    expect(html).toContain("Visibility and policy");
    expect(html).toContain("Current sharing grants");
    expect(html).toContain("Add sharing grant");
    expect(html).toContain("Permission feedback");
    expect(html).toContain("/settings/sharing?resourceFamily=workflow&amp;resourceType=workflow+type&amp;resourceId=wf%3A2&amp;workspaceId=workspace%3A1");
  });
});

