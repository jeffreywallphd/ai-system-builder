import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeConsoleDrawer from "../RuntimeConsoleDrawer";

describe("RuntimeConsoleDrawer", () => {
  it("renders collapsed and expanded views", () => {
    const collapsed = renderToStaticMarkup(
      createElement(RuntimeConsoleDrawer, {
        isExpanded: false,
        events: [],
        onToggleExpanded: () => undefined,
        onClearEvents: () => undefined,
      })
    );
    expect(collapsed).not.toContain("Runtime events will appear here.");

    const expanded = renderToStaticMarkup(
      createElement(RuntimeConsoleDrawer, {
        isExpanded: true,
        events: [],
        onToggleExpanded: () => undefined,
        onClearEvents: () => undefined,
      })
    );
    expect(expanded).toContain("Runtime events will appear here.");
  });
});
