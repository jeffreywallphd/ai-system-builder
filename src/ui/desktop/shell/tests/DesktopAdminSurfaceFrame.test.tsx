import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DesktopAdminSurfaceFrame from "../DesktopAdminSurfaceFrame";

describe("DesktopAdminSurfaceFrame", () => {
  it("composes navigation, content, and detail regions", () => {
    const html = renderToStaticMarkup(
      React.createElement(DesktopAdminSurfaceFrame, {
        title: "Workspace administration",
        subtitle: "Administrative shell",
        navigation: React.createElement("div", undefined, "workspace nav"),
        content: React.createElement("div", undefined, "workspace content"),
        detail: React.createElement("div", undefined, "workspace detail"),
      }),
    );

    expect(html).toContain("ui-shell ui-shell--desktop");
    expect(html).toContain("Navigation");
    expect(html).toContain("Workspace");
    expect(html).toContain("Detail");
  });

  it("renders permission fallback when disallowed", () => {
    const html = renderToStaticMarkup(
      React.createElement(DesktopAdminSurfaceFrame, {
        title: "Workspace administration",
        isAllowed: false,
        content: React.createElement("div", undefined, "hidden"),
      }),
    );

    expect(html).toContain("Access required");
    expect(html).toContain("administrative surface");
  });
});
