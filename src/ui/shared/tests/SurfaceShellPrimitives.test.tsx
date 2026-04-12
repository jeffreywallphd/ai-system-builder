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
import { createSurfaceResponsiveProfile } from "../responsive";

describe("Surface shell primitives", () => {
  it("renders frame, header, and regions with shared classes", () => {
    const responsiveProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 1000 });
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
          { responsiveProfile },
          React.createElement(SurfaceNavigationRegion, { title: "Navigation" }, "nav"),
          React.createElement(SurfaceContentRegion, { title: "Content" }, "content"),
          React.createElement(SurfaceDetailPane, { title: "Detail" }, "detail"),
        ),
      ),
    );

    expect(html).toContain("ui-shell ui-shell--desktop");
    expect(html).toContain("<nav");
    expect(html).toContain("<aside");
    expect(html).toContain("aria-labelledby");
    expect(html).toContain("Node operations");
    expect(html).toContain("Navigation");
    expect(html).toContain("Content");
    expect(html).toContain("Detail");
    expect(html).toContain("ui-responsive-panel-layout--split-with-collapsed-detail");
    expect(html).toContain("data-navigation-mode=\"collapsible\"");
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
    expect(html).toContain("role=\"status\"");
    expect(html).toContain("aria-live=\"polite\"");
    expect(html).toContain("warning content");
  });

  it("renders danger status as an alert region", () => {
    const html = renderToStaticMarkup(
      React.createElement(SurfaceStatusRegion, { tone: "danger" }, "danger content"),
    );

    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("aria-live=\"assertive\"");
  });
});
