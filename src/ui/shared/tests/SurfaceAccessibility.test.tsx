import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SurfaceLiveRegion,
  SurfaceSkipLink,
  toSurfaceRouteAnnouncement,
} from "../accessibility";

describe("Surface accessibility foundations", () => {
  it("projects route pathnames into screen-reader announcements", () => {
    expect(toSurfaceRouteAnnouncement("/")).toBe("Navigated to home.");
    expect(toSurfaceRouteAnnouncement("/settings/node-inventory")).toBe("Navigated to settings / node inventory.");
  });

  it("renders skip link and live region semantics", () => {
    const html = renderToStaticMarkup(
      <div>
        <SurfaceSkipLink targetId="main-content" />
        <SurfaceLiveRegion message="Updated" politeness="assertive" />
      </div>,
    );

    expect(html).toContain("href=\"#main-content\"");
    expect(html).toContain("Skip to main content");
    expect(html).toContain("role=\"status\"");
    expect(html).toContain("aria-live=\"assertive\"");
    expect(html).toContain("ui-visually-hidden");
  });
});
