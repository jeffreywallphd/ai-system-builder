import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutionMonitorPanel } from "../runtime/ExecutionMonitorPanel";
import { ExecutionResultPanel } from "../runtime/ExecutionResultPanel";

describe("System runtime execution monitoring/result panels", () => {
  it("renders bounded monitoring sections from runtime status + trace payloads", () => {
    const html = renderToStaticMarkup(
      <ExecutionMonitorPanel
        status={{
          executionId: "exec-1",
          status: "running",
          rootAssetId: "asset:system",
          startedAt: "2026-03-28T00:00:00.000Z",
          updatedAt: "2026-03-28T00:00:01.000Z",
          progress: {
            totalNodeCount: 3,
            completedNodeCount: 1,
            failedNodeCount: 0,
            runningNodeCount: 1,
            updatedAt: "2026-03-28T00:00:01.000Z",
          },
          errorCount: 0,
          nodeStatuses: [
            {
              nodeId: "system:asset:system:",
              path: ["system:asset:system:"],
              structuralKind: "system",
              semanticRole: "system",
              behaviorKind: "iterative",
              status: "running",
              iterationCount: 1,
              planningCycleCount: 0,
              updatedAt: "2026-03-28T00:00:01.000Z",
            },
          ],
          nestedSystems: [
            {
              nodeId: "system:asset:system:",
              status: "running",
              path: ["system:asset:system:"],
            },
          ],
          recovery: {
            decisionCount: 1,
            retryDecisionCount: 1,
          },
        }}
        trace={{
          executionId: "exec-1",
          trace: {
            events: [
              {
                eventId: "event-1",
                executionId: "exec-1",
                at: "2026-03-28T00:00:01.000Z",
                kind: "node-status-changed",
                nodeId: "system:asset:system:",
                summary: "Node running",
              },
            ],
            logs: [
              {
                entryId: "log-1",
                level: "warning",
                message: "Retry scheduled",
                emittedAt: "2026-03-28T00:00:01.000Z",
              },
            ],
            lastEventAt: "2026-03-28T00:00:01.000Z",
          },
        }}
      />,
    );

    expect(html).toContain("Execution status");
    expect(html).toContain("Step/node status");
    expect(html).toContain("Nested system execution state");
    expect(html).toContain("Bounded trace/log entries");
    expect(html).toContain("Retry scheduled");
  });

  it("renders execution result summaries, node outputs, nested summaries, and diagnostics", () => {
    const html = renderToStaticMarkup(
      <ExecutionResultPanel
        result={{
          executionId: "exec-1",
          status: "failed",
          rootAssetId: "asset:system",
          output: {
            payload: {
              nodeResults: {
                "system:asset:system:": { summary: "partial" },
              },
            },
            error: {
              code: "runtime-failure",
              message: "Node failed",
            },
          },
          outputSummary: {
            hasOutput: true,
            hasError: true,
            outputFieldCount: 1,
            contractOutputIds: ["response"],
          },
          nodeResults: [
            {
              nodeId: "system:asset:system:",
              path: ["system:asset:system:"],
              structuralKind: "system",
              semanticRole: "system",
              status: "failed",
              outputSummary: "Object(1 fields)",
              hasOutput: true,
              hasError: true,
            },
          ],
          nestedSystemResults: [
            {
              nodeId: "system:asset:system:",
              status: "failed",
              outputSummary: "Object(1 fields)",
              path: ["system:asset:system:"],
            },
          ],
          diagnostics: [
            {
              source: "runtime-error",
              severity: "error",
              code: "runtime-failure",
              message: "Node failed",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Execution output summary");
    expect(html).toContain("Step/node output summaries");
    expect(html).toContain("Nested system result summaries");
    expect(html).toContain("Diagnostics/error outputs");
    expect(html).toContain("runtime-failure");
  });
});
