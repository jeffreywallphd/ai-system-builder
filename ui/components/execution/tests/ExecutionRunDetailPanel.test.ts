import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ExecutionRunDetailPanel from "../ExecutionRunDetailPanel";

describe("ExecutionRunDetailPanel", () => {
  it("renders related run lineage entries when a related cluster is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutionRunDetailPanel, {
        emptyMessage: "none",
        detail: {
          summary: {
            runId: "run-1",
            planId: "plan-1",
            executionKind: "workflow",
            executionFlowId: "flow-1",
            status: "completed",
            statusLabel: "Completed",
            statusTone: "success",
            completedUnits: 1,
            totalUnits: 1,
            progressPercent: 100,
            progressLabel: "1/1 units",
            executionPathLabel: "Delegated execution",
            startedAt: "2026-03-24T00:00:00.000Z",
            updatedAt: "2026-03-24T00:00:01.000Z",
            durationSummary: "1s",
          },
          runId: "run-1",
          planId: "plan-1",
          executionKind: "workflow",
          status: "completed",
          cancellationSupported: true,
          startedAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:01.000Z",
          durationSummary: "1s",
          metadata: [],
          runLevelMetadata: [],
          diagnostics: [],
          executionPathLabel: "Delegated execution",
          provenanceEntries: [],
          units: [],
          timeline: [],
        },
        relatedRunCluster: {
          groupId: "flow-1",
          groupLabel: "Execution flow flow-1",
          anchorRunId: "run-1",
          orderingLabel: "Newest first",
          runs: [
            {
              run: {
                runId: "run-2",
                planId: "plan-1",
                executionKind: "workflow",
                executionFlowId: "flow-1",
                status: "completed",
                statusLabel: "Completed",
                statusTone: "success",
                completedUnits: 1,
                totalUnits: 1,
                progressPercent: 100,
                progressLabel: "1/1 units",
                executionPathLabel: "Delegated execution",
                startedAt: "2026-03-24T00:00:02.000Z",
                updatedAt: "2026-03-24T00:00:03.000Z",
                durationSummary: "1s",
              },
              isAnchor: false,
              relationLabel: "Related run",
            },
            {
              run: {
                runId: "run-1",
                planId: "plan-1",
                executionKind: "workflow",
                executionFlowId: "flow-1",
                status: "completed",
                statusLabel: "Completed",
                statusTone: "success",
                completedUnits: 1,
                totalUnits: 1,
                progressPercent: 100,
                progressLabel: "1/1 units",
                executionPathLabel: "Delegated execution",
                startedAt: "2026-03-24T00:00:00.000Z",
                updatedAt: "2026-03-24T00:00:01.000Z",
                durationSummary: "1s",
              },
              isAnchor: true,
              relationLabel: "Anchor run",
            },
          ],
        },
      }),
    );

    expect(html).toContain("Related runs");
    expect(html).toContain("Execution flow flow-1");
    expect(html).toContain("Related run: run-2");
    expect(html).toContain("Anchor run: run-1");
  });
});
