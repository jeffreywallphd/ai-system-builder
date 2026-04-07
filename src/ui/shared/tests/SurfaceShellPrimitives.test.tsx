import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PermissionGuardContainer,
  SurfaceContentRegion,
  SurfaceDetailPane,
  SurfaceFrame,
  SurfaceHeaderBar,
  SurfaceNavigationRegion,
  SurfaceRegionLayout,
  SurfaceStatusRegion,
} from "../components/shell";

describe("Surface shell primitives", () => {
  it("renders frame, header, and regions with shared classes", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        SurfaceFrame,
        { surface: "desktop" },
        React.createElement(SurfaceHeaderBar, {
          title: "Node operations",
          subtitle: "Surface shell test",
        }),
        React.createElement(
          SurfaceRegionLayout,
          undefined,
          React.createElement(SurfaceNavigationRegion, { title: "Navigation" }, "nav"),
          React.createElement(SurfaceContentRegion, { title: "Content" }, "content"),
          React.createElement(SurfaceDetailPane, { title: "Detail" }, "detail"),
        ),
      ),
    );

    expect(html).toContain("ui-shell ui-shell--desktop");
    expect(html).toContain("Node operations");
    expect(html).toContain("Navigation");
    expect(html).toContain("Content");
    expect(html).toContain("Detail");
  });

  it("renders permission fallback and unavailable messaging", () => {
    const unauthorizedHtml = renderToStaticMarkup(
      React.createElement(
        PermissionGuardContainer,
        { isAllowed: false },
        React.createElement("div", undefined, "hidden"),
      ),
    );

    const unavailableHtml = renderToStaticMarkup(
      React.createElement(
        PermissionGuardContainer,
        { isAllowed: false, unavailable: true },
        React.createElement("div", undefined, "hidden"),
      ),
    );

    expect(unauthorizedHtml).toContain("Access required");
    expect(unavailableHtml).toContain("Surface unavailable");
  });

  it("renders status region tone variants", () => {
    const html = renderToStaticMarkup(
      React.createElement(SurfaceStatusRegion, { tone: "warning" }, "warning content"),
    );

    expect(html).toContain("ui-shell-status ui-shell-status--warning");
    expect(html).toContain("warning content");
  });
});
