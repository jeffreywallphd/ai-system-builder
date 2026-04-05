import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../LoginPage";
import RegisterPage from "../RegisterPage";
import IdentityAdminPage from "../IdentityAdminPage";
import TrustedDevicesPage from "../TrustedDevicesPage";

describe("Identity auth pages", () => {
  it("renders login and registration form controls", () => {
    const loginHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(LoginPage, {
        onAuthenticated: () => undefined,
        authNotice: "session-expired",
      })),
    );
    const registerHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(RegisterPage)),
    );
    const adminHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(IdentityAdminPage)),
    );
    const trustedDevicesHtml = renderToStaticMarkup(
      React.createElement(MemoryRouter, undefined, React.createElement(TrustedDevicesPage)),
    );

    expect(loginHtml).toContain("Sign in to AI Loom Studio");
    expect(loginHtml).toContain("Username");
    expect(loginHtml).toContain("Password");
    expect(loginHtml).toContain("Your session expired. Sign in again to continue.");
    expect(registerHtml).toContain("Create a local AI Loom account");
    expect(registerHtml).toContain("Confirm password");
    expect(adminHtml).toContain("Identity administration");
    expect(trustedDevicesHtml).toContain("Trusted devices");
  });
});
