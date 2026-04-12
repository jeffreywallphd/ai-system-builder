import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SecurityPolicyConfigurationPage, { validateSharingPolicySelection } from "../SecurityPolicyConfigurationPage";
import type { IdentityAuthSessionStore } from "@ui/shared/identity/IdentityAuthSessionStore";

describe("SecurityPolicyConfigurationPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(SecurityPolicyConfigurationPage)),
    );

    expect(html).toContain("Security and policy configuration");
    expect(html).toContain("Sign in with an authenticated administrative session");
    expect(html).toContain("Go to sign in");
  });

  it("renders editable policy controls for admin-capable sessions", () => {
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
        sessionTrustState: "trusted" as const,
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
        React.createElement(SecurityPolicyConfigurationPage, { sessionStore }),
      ),
    );

    expect(html).toContain("Sharing policy controls");
    expect(html).toContain("Editable");
    expect(html).toContain("Trust posture");
    expect(html).toContain("Inspect only");
    expect(html).toContain("Storage policy visibility");
    expect(html).toContain("Load policy controls");
    expect(html).toContain("Inspect storage policy");
  });

  it("marks sharing controls as read-only for member sessions", () => {
    const sessionStore = {
      getSession: () => Object.freeze({
        userIdentityId: "member-1",
        username: "member-user",
        providerId: "local",
        sessionId: "session-2",
        sessionToken: "token-2",
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
              effectiveRoles: Object.freeze(["member"] as const),
              canAdministrate: false,
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
        React.createElement(SecurityPolicyConfigurationPage, { sessionStore }),
      ),
    );

    expect(html).toContain("read-only (insufficient role)");
    expect(html).toContain("cannot edit sharing policy from this surface");
  });
});

describe("validateSharingPolicySelection", () => {
  it("requires resource type and id", () => {
    expect(validateSharingPolicySelection({
      scope: "workspace",
      workspaceId: "workspace-alpha",
      resourceFamily: "asset",
      resourceType: "",
      resourceId: "",
    })).toEqual({
      ok: false,
      message: "Resource type is required.",
    });
  });

  it("requires workspace id for workspace scope", () => {
    expect(validateSharingPolicySelection({
      scope: "workspace",
      workspaceId: "",
      resourceFamily: "asset",
      resourceType: "asset",
      resourceId: "asset:123",
    })).toEqual({
      ok: false,
      message: "Workspace id is required for workspace scope.",
    });
  });

  it("allows platform scope without workspace id", () => {
    const result = validateSharingPolicySelection({
      scope: "platform",
      workspaceId: "",
      resourceFamily: "system",
      resourceType: "system-policy",
      resourceId: "system-policy:baseline",
    });

    expect(result.ok).toBeTrue();
    if (result.ok) {
      expect(result.selection.workspaceId).toBeUndefined();
      expect(result.selection.resourceFamily).toBe("system");
    }
  });
});
