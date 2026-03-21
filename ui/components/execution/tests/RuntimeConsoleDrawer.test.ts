import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeConsoleDrawer from "../RuntimeConsoleDrawer";

describe("RuntimeConsoleDrawer", () => {
  it("renders collapsed, health, and logs views", () => {
    const collapsed = renderToStaticMarkup(
      createElement(RuntimeConsoleDrawer, {
        isExpanded: false,
        activeTab: "health",
        events: [],
        logs: [],
        healthChecks: [],
        onToggleExpanded: () => undefined,
        onSelectTab: () => undefined,
        onClearLogs: () => undefined,
        onRefreshHealth: () => undefined,
        onRestartRuntime: () => undefined,
        canRestartRuntime: true,
        isRestartingRuntime: false,
      })
    );
    expect(collapsed).not.toContain("Server health");

    const health = renderToStaticMarkup(
      createElement(RuntimeConsoleDrawer, {
        isExpanded: true,
        activeTab: "health",
        events: [],
        logs: [],
        healthChecks: [],
        onToggleExpanded: () => undefined,
        onSelectTab: () => undefined,
        onClearLogs: () => undefined,
        onRefreshHealth: () => undefined,
        onRestartRuntime: () => undefined,
        canRestartRuntime: true,
        isRestartingRuntime: false,
      })
    );
    expect(health).toContain("Server health");
    expect(health).toContain("Health checks will appear here.");

    const logs = renderToStaticMarkup(
      createElement(RuntimeConsoleDrawer, {
        isExpanded: true,
        activeTab: "logs",
        events: [],
        logs: [],
        healthChecks: [],
        onToggleExpanded: () => undefined,
        onSelectTab: () => undefined,
        onClearLogs: () => undefined,
        onRefreshHealth: () => undefined,
        onRestartRuntime: () => undefined,
        canRestartRuntime: true,
        isRestartingRuntime: false,
      })
    );
    expect(logs).toContain("Runtime logs");
    expect(logs).toContain("Runtime logs will appear here.");
    expect(logs).toContain("Refresh health");
    expect(logs).toContain("Restart runtime");
  });
});
