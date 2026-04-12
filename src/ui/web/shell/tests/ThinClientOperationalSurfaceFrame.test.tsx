import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ThinClientOperationalSurfaceFrame from "../ThinClientOperationalSurfaceFrame";

describe("ThinClientOperationalSurfaceFrame", () => {
  it("composes thin-client shell regions", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThinClientOperationalSurfaceFrame, {
        title: "Workspace memberships",
        subtitle: "Thin operations shell",
        navigation: React.createElement("div", undefined, "workspace selector"),
        content: React.createElement("div", undefined, "membership list"),
        detail: React.createElement("div", undefined, "invite status"),
      }),
    );

    expect(html).toContain("ui-shell ui-shell--thin");
    expect(html).toContain("Context");
    expect(html).toContain("Operations");
    expect(html).toContain("Insights");
  });

  it("renders unavailable fallback", () => {
    const html = renderToStaticMarkup(
      React.createElement(ThinClientOperationalSurfaceFrame, {
        title: "Workspace memberships",
        isAllowed: false,
        unavailable: true,
        content: React.createElement("div", undefined, "hidden"),
      }),
    );

    expect(html).toContain("Surface unavailable");
  });
});
