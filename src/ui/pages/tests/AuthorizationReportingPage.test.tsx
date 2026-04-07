import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AuthorizationReportingPage from "../AuthorizationReportingPage";
import type { AuthorizationManagementService } from "../../services/AuthorizationManagementService";
import type { IdentityAuthSessionStore } from "@shared/identity/IdentityAuthSessionStore";

describe("AuthorizationReportingPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(AuthorizationReportingPage)),
    );

    expect(html).toContain("Authorization reporting");
    expect(html).toContain("Sign in with an authenticated admin-capable account");
    expect(html).toContain("Go to sign in");
  });

  it("renders reporting query controls for authenticated sessions", () => {
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
        undefined,
        React.createElement(AuthorizationReportingPage, {
          sessionStore,
          service,
        }),
      ),
    );

    expect(html).toContain("Authorization reporting");
    expect(html).toContain("Report query");
    expect(html).toContain("Workspace id");
    expect(html).toContain("Load report");
  });
});

