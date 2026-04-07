import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import SecretMetadataManagementPage from "../SecretMetadataManagementPage";

describe("SecretMetadataManagementPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(SecretMetadataManagementPage)),
    );

    expect(html).toContain("Secret metadata management");
    expect(html).toContain("Sign in with an authenticated admin-capable account");
    expect(html).toContain("Go to sign in");
  });
});
