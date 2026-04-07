import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import TrustedDevicesPage from "../TrustedDevicesPage";

describe("TrustedDevicesPage", () => {
  it("renders sign-in guidance when there is no local session", () => {
    const html = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(TrustedDevicesPage)),
    );

    expect(html).toContain("Trusted devices");
    expect(html).toContain("Sign in before pairing or revoking trusted devices.");
    expect(html).toContain("Go to sign in");
  });
});
