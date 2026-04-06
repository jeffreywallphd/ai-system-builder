import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import StorageAdministrationPage from "../StorageAdministrationPage";
import type { IdentityAuthSessionStore } from "../../shared/identity/IdentityAuthSessionStore";
import type { StorageAdministrationService } from "../../services/StorageAdministrationService";

describe("StorageAdministrationPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(StorageAdministrationPage)),
    );

    expect(html).toContain("Managed storage administration");
    expect(html).toContain("Sign in with an authenticated admin account");
    expect(html).toContain("Go to sign in");
  });

  it("renders list and detail layout for authenticated sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "admin:storage:1",
        username: "storage-admin",
        providerId: "local",
        sessionId: "session-1",
        sessionToken: "token-1",
        sessionTokenType: "Bearer" as const,
        sessionIssuedAt: "2026-04-06T10:00:00.000Z",
        sessionExpiresAt: "2026-04-06T22:00:00.000Z",
      }),
      isSessionExpired: () => false,
    } as unknown as IdentityAuthSessionStore;

    const service = {} as StorageAdministrationService;
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        undefined,
        React.createElement(StorageAdministrationPage, {
          sessionStore,
          service,
        }),
      ),
    );

    expect(html).toContain("Managed storage administration");
    expect(html).toContain("Create and edit workflows");
    expect(html).toContain("List query");
    expect(html).toContain("Storage instances");
    expect(html).toContain("Storage detail");
    expect(html).toContain("No storage instances matched the current query.");
  });
});
