import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import WorkspaceAdministrationPage from "../WorkspaceAdministrationPage";

describe("WorkspaceAdministrationPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(WorkspaceAdministrationPage)),
    );

    expect(html).toContain("Workspace administration");
    expect(html).toContain("Sign in with an authenticated admin-capable account");
    expect(html).toContain("Go to sign in");
  });
});
