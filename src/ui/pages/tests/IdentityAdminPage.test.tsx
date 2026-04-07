import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import IdentityAdminPage from "../IdentityAdminPage";

describe("IdentityAdminPage", () => {
  it("renders authenticated-session guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(IdentityAdminPage)),
    );

    expect(html).toContain("Identity administration");
    expect(html).toContain("Sign in with an authenticated admin-capable account");
    expect(html).toContain("Go to sign in");
  });
});
