import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeConsoleToolbar from "../RuntimeConsoleToolbar";

describe("RuntimeConsoleToolbar", () => {
  it("renders toggle, count, and clear actions", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeConsoleToolbar, {
        isExpanded: false,
        eventCount: 3,
        onToggle: () => undefined,
        onClear: () => undefined,
      })
    );

    expect(html).toContain("Show Runtime Console");
    expect(html).toContain("3 events");
    expect(html).toContain("Clear");
  });
});
