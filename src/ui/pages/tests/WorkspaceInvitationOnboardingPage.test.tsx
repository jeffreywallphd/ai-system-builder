import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import WorkspaceInvitationOnboardingPage from "../WorkspaceInvitationOnboardingPage";

describe("WorkspaceInvitationOnboardingPage", () => {
  it("renders sign-in guidance for invitation acceptance when unauthenticated", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/workspaces/workspace:alpha/invitations/tok_join_123/accept"] },
        React.createElement(
          Routes,
          undefined,
          React.createElement(
            Route,
            {
              path: "/workspaces/:workspaceId/invitations/:invitationToken/accept",
              element: React.createElement(WorkspaceInvitationOnboardingPage),
            },
          ),
        ),
      ),
    );

    expect(html).toContain("Workspace invitation");
    expect(html).toContain("Sign in before accepting this workspace invitation");
    expect(html).toContain("Go to sign in");
  });
});
