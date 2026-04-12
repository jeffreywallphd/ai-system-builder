import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RunDesktopOperationalDashboardPage from "../RunDesktopOperationalDashboardPage";
import RunThinClientOperationalDashboardPage from "../RunThinClientOperationalDashboardPage";

describe("Run operational dashboard surface pages", () => {
  it("renders desktop operational surface composition", () => {
    const html = renderToStaticMarkup(
      React.createElement(RunDesktopOperationalDashboardPage, {
        navigation: React.createElement("div", undefined, "nav"),
        content: React.createElement("div", undefined, "content"),
        detail: React.createElement("div", undefined, "detail"),
      }),
    );

    expect(html).toContain("ui-shell ui-shell--desktop");
    expect(html).toContain("Operational workspace dashboard");
  });

  it("renders thin-client operational surface composition", () => {
    const html = renderToStaticMarkup(
      React.createElement(RunThinClientOperationalDashboardPage, {
        navigation: React.createElement("div", undefined, "nav"),
        content: React.createElement("div", undefined, "content"),
        detail: React.createElement("div", undefined, "detail"),
      }),
    );

    expect(html).toContain("ui-shell ui-shell--thin");
    expect(html).toContain("Operational workspace dashboard");
  });
});
