import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import DeploymentPolicyAdministrationPage, {
  validateOverrideDraft,
  validateProfileChangeDraft,
} from "../DeploymentPolicyAdministrationPage";
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
    expect(html).toContain("Active profile administration");
    expect(html).toContain("Policy override administration");
    expect(html).toContain("Control support matrix");
  });
});

describe("DeploymentPolicyAdministrationPage draft validation", () => {
  it("requires confirmation and ticket reference for profile updates when policy requires ticket references", () => {
    const notConfirmed = validateProfileChangeDraft({
      draft: {
        profileId: "home",
        reason: "",
        ticketReference: "CHG-1",
        dryRun: true,
        confirmed: false,
      },
      ticketReferenceRequired: true,
    });
    expect(notConfirmed.ok).toBeFalse();

    const missingTicket = validateProfileChangeDraft({
      draft: {
        profileId: "home",
        reason: "",
        ticketReference: "",
        dryRun: true,
        confirmed: true,
      },
      ticketReferenceRequired: true,
    });
    expect(missingTicket.ok).toBeFalse();
  });

  it("validates typed override values and remove preconditions", () => {
    const missingOverride = validateOverrideDraft({
      draft: {
        profileId: "home",
        settingPath: "storage-governance.retentionDaysDefault",
        operation: "remove",
        valueText: "",
        valueBoolean: "true",
        reason: "",
        ticketReference: "CHG-2",
        dryRun: true,
        confirmed: true,
      },
      selectedSetting: {
        familyId: "storage-governance",
        familyLabel: "Storage governance",
        settingKey: "retentionDaysDefault",
        description: "Retention days",
        controlMode: "runtime-admin",
        valueType: "number",
        effectiveValue: 90,
        effectiveValueDisplay: "90",
        effectiveSource: "policy-default",
        sourceLabel: "Policy default",
        provenanceSummary: "none",
        administrationStatus: "editable",
        administrationStatusReason: "editable",
      },
      ticketReferenceRequired: true,
    });
    expect(missingOverride.ok).toBeFalse();

    const invalidNumber = validateOverrideDraft({
      draft: {
        profileId: "home",
        settingPath: "storage-governance.retentionDaysDefault",
        operation: "upsert",
        valueText: "abc",
        valueBoolean: "true",
        reason: "",
        ticketReference: "CHG-2",
        dryRun: true,
        confirmed: true,
      },
      selectedSetting: {
        familyId: "storage-governance",
        familyLabel: "Storage governance",
        settingKey: "retentionDaysDefault",
        description: "Retention days",
        controlMode: "runtime-admin",
        valueType: "number",
        effectiveValue: 90,
        effectiveValueDisplay: "90",
        effectiveSource: "policy-default",
        sourceLabel: "Policy default",
        provenanceSummary: "none",
        administrationStatus: "editable",
        administrationStatusReason: "editable",
      },
      ticketReferenceRequired: true,
    });
    expect(invalidNumber.ok).toBeFalse();
  });
});
