import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import NodeInventoryPage from "../NodeInventoryPage";
import type { IdentityAuthSessionStore } from "../../shared/identity/IdentityAuthSessionStore";

describe("NodeInventoryPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(NodeInventoryPage)),
    );

    expect(html).toContain("Trusted node inventory");
    expect(html).toContain("Sign in with an authenticated admin account");
    expect(html).toContain("Go to sign in");
  });

  it("renders inventory layout for authenticated sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "admin:node:1",
        username: "node-admin",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-05T11:00:00.000Z",
        sessionExpiresAt: "2026-04-05T23:00:00.000Z",
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(NodeInventoryPage, { sessionStore }),
      ),
    );

    expect(html).toContain("Trusted node inventory");
    expect(html).toContain("Filters");
    expect(html).toContain("Inventory");
    expect(html).toContain("Node detail");
    expect(html).toContain("No nodes matched the current inventory filters.");
  });
});
