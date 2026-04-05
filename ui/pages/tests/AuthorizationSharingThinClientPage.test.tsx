import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import AuthorizationSharingThinClientPage from "../AuthorizationSharingThinClientPage";

describe("AuthorizationSharingThinClientPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(AuthorizationSharingThinClientPage)),
    );

    expect(html).toContain("Sharing access review");
    expect(html).toContain("Sign in with an authenticated account");
    expect(html).toContain("Go to sign in");
  });
});
