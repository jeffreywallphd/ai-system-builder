import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import ExecutionHistoryPanel from "../ExecutionHistoryPanel";

describe("ExecutionHistoryPanel", () => {
  it("renders projected durable execution history", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutionHistoryPanel, {
        title: "Recent execution history",
        subtitle: "Durable plan-backed runs.",
        emptyMessage: "No runs yet.",
        items: [
          {
            runId: "run-1",
            planId: "workflow-run:wf-1",
            executionKind: "workflow",
            status: "completed",
            statusLabel: "Completed",
            statusTone: "success",
            currentUnitId: "workflow:wf-1",
            currentUnitLabel: "Run workflow",
            completedUnits: 1,
            totalUnits: 1,
            progressPercent: 100,
            progressLabel: "1/1 units",
            terminalSummary: "Workflow run completed — 1 output asset captured.",
            executionPathLabel: "Delegated execution",
            executionPathDetail: "Delegated to Python.",
            startedAt: "2026-03-23T00:00:00.000Z",
            updatedAt: "2026-03-23T00:00:02.000Z",
            completedAt: "2026-03-23T00:00:02.000Z",
            durationSummary: "2s",
            metadataSummary: "Support flow",
          },
        ],
      }),
    );

    expect(html).toContain("Recent execution history");
    expect(html).toContain("run-1");
    expect(html).toContain("Delegated execution");
    expect(html).toContain("Support flow");
  });
});
