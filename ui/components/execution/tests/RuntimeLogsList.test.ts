import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RuntimeLogsList, { filterRuntimeLogs } from "../RuntimeLogsList";

const sampleLogs = Object.freeze([
  {
    id: "log-1",
    timestamp: "2026-03-21T10:00:00.000Z",
    severity: "error" as const,
    source: "network" as const,
    message: "Failed to execute 'fetch' on 'Window': Illegal invocation.",
    details: "Failed request while refreshing runtime health.",
    stack: "Error: Illegal invocation\n    at refreshHealth",
  },
  {
    id: "log-2",
    timestamp: "2026-03-21T10:01:00.000Z",
    severity: "warn" as const,
    source: "mcp-runtime" as const,
    message: "Configured MCP servers could not be listed.",
  },
  {
    id: "log-3",
    timestamp: "2026-03-21T10:02:00.000Z",
    severity: "info" as const,
    source: "ui" as const,
    message: "Runtime console opened on mobile.",
  },
]);

describe("RuntimeLogsList", () => {
  it("renders log cards with metadata, actions, and expandable error details", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeLogsList, {
        logs: sampleLogs,
        activeFilter: "all",
        onFilterChange: () => undefined,
        onClearLogs: () => undefined,
        onRefreshHealth: () => undefined,
        onRestartRuntime: () => undefined,
        canRestartRuntime: true,
        isRestartingRuntime: false,
      }),
    );

    expect(html).toContain("Runtime logs");
    expect(html).toContain("Refresh health");
    expect(html).toContain("Clear logs");
    expect(html).toContain("Restart runtime");
    expect(html).toContain("Show error details");
    expect(html).toContain("Failed to execute &#x27;fetch&#x27; on &#x27;Window&#x27;: Illegal invocation.");
    expect(html).toContain("network");
  });

  it("filters logs by severity", () => {
    expect(filterRuntimeLogs(sampleLogs, "all")).toHaveLength(3);
    expect(filterRuntimeLogs(sampleLogs, "error").map((log) => log.id)).toEqual(["log-1"]);
    expect(filterRuntimeLogs(sampleLogs, "warn").map((log) => log.id)).toEqual(["log-2"]);
    expect(filterRuntimeLogs(sampleLogs, "info").map((log) => log.id)).toEqual(["log-3"]);
  });

  it("keeps mobile-friendly controls visible in the rendered markup", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeLogsList, {
        logs: sampleLogs,
        activeFilter: "error",
        onFilterChange: () => undefined,
        onClearLogs: () => undefined,
        onRefreshHealth: () => undefined,
        canRestartRuntime: false,
      }),
    );

    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("ui-runtime-console__filter");
    expect(html).toContain("ui-runtime-console__log-card");
  });
});
