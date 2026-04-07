import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import WorkspaceMembershipThinClientPage from "../WorkspaceMembershipThinClientPage";

describe("WorkspaceMembershipThinClientPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(WorkspaceMembershipThinClientPage)),
    );

    expect(html).toContain("Workspace memberships");
    expect(html).toContain("Sign in with an authenticated account");
    expect(html).toContain("Go to sign in");
  });
});
