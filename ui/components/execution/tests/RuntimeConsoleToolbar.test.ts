import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeConsoleToolbar from "../RuntimeConsoleToolbar";

describe("RuntimeConsoleToolbar", () => {
  it("renders toggle, tabs, count, and clear actions", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeConsoleToolbar, {
        isExpanded: true,
        activeTab: "logs",
        logCount: 3,
        onToggle: () => undefined,
        onSelectTab: () => undefined,
        onClearLogs: () => undefined,
      })
    );

    expect(html).toContain("Hide Runtime Console");
    expect(html).toContain("Health");
    expect(html).toContain("Logs");
    expect(html).toContain("aria-selected=\"true\"");
    expect(html).toContain("3 logs");
    expect(html).toContain("Clear logs");
  });
});
