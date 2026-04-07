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
    details: "status 500 • refresh-runtime-health • Failed to execute 'fetch' on 'Window': Illegal invocation.",
    stack: "Error: Illegal invocation\n    at refreshHealth\n    at phoneConsole",
    stackPreview: "Error: Illegal invocation\n    at refreshHealth\n    at phoneConsole",
    requestMethod: "GET",
    target: "/mcp/status",
    diagnostics: {
      message: "Failed to execute 'fetch' on 'Window': Illegal invocation.",
      stack: "Error: Illegal invocation\n    at refreshHealth\n    at phoneConsole",
      cause: "Illegal invocation",
      causeChain: [
        {
          message: "Illegal invocation",
          name: "TypeError",
          stack: "TypeError: Illegal invocation\n    at refreshHealth",
        },
      ],
      subsystem: "mcp-runtime",
      className: "RuntimeConsoleStore",
      methodName: "refreshHealth",
      operation: "refresh-runtime-health",
      target: "/mcp/status",
      requestMethod: "GET",
      failedBeforeResponse: true,
      details: { screen: "logs" },
      name: "TypeError",
    },
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
  it("renders compact normal-mode logs with request context and mobile-friendly controls", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeLogsList, {
        logs: sampleLogs,
        activeFilter: "all",
        logVerbosity: "normal",
        onFilterChange: () => undefined,
        onLogVerbosityChange: () => undefined,
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
    expect(html).toContain("Verbosity");
    expect(html).toContain("GET /mcp/status");
    expect(html).toContain("Failed to execute &#x27;fetch&#x27; on &#x27;Window&#x27;: Illegal invocation.");
    expect(html).toContain("Error: Illegal invocation");
    expect(html).not.toContain("Verbose diagnostics");
  });

  it("renders expanded verbose diagnostics when verbose mode is selected", () => {
    const html = renderToStaticMarkup(
      createElement(RuntimeLogsList, {
        logs: sampleLogs,
        activeFilter: "error",
        logVerbosity: "verbose",
        onFilterChange: () => undefined,
        onLogVerbosityChange: () => undefined,
        onClearLogs: () => undefined,
        onRefreshHealth: () => undefined,
        canRestartRuntime: false,
      }),
    );

    expect(html).toContain("Verbose diagnostics");
    expect(html).toContain("Cause chain");
    expect(html).toContain("Full stack trace");
    expect(html).toContain("refresh-runtime-health");
    expect(html).toContain("RuntimeConsoleStore");
    expect(html).toContain("TypeError");
  });

  it("filters logs by severity", () => {
    expect(filterRuntimeLogs(sampleLogs, "all")).toHaveLength(3);
    expect(filterRuntimeLogs(sampleLogs, "error").map((log) => log.id)).toEqual(["log-1"]);
    expect(filterRuntimeLogs(sampleLogs, "warn").map((log) => log.id)).toEqual(["log-2"]);
    expect(filterRuntimeLogs(sampleLogs, "info").map((log) => log.id)).toEqual(["log-3"]);
  });
});
