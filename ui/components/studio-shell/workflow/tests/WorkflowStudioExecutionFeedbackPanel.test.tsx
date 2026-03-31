import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { WorkflowStudioRunFeedback } from "../WorkflowStudioExecutionFeedbackPanel";
import WorkflowStudioExecutionFeedbackPanel from "../WorkflowStudioExecutionFeedbackPanel";

describe("WorkflowStudioExecutionFeedbackPanel", () => {
  it("renders unknown readiness state before validation checks run", () => {
    const html = renderToStaticMarkup(
      <WorkflowStudioExecutionFeedbackPanel />,
    );

    expect(html).toContain('data-testid="studio-shell-workflow-run-feedback"');
    expect(html).toContain('data-testid="studio-shell-workflow-readiness-badge"');
    expect(html).toContain("Unknown");
    expect(html).toContain("Run Validation to refresh execution readiness before launch.");
  });

  it("renders blocking readiness issues and launch status transitions", () => {
    const runFeedback: WorkflowStudioRunFeedback = Object.freeze({
      status: "blocked",
      message: "Workflow launch was blocked by pre-execution validation issues.",
      result: Object.freeze({
        launchStatus: "blocked",
        execution: Object.freeze({
          executionId: "exec-1",
          state: "failed",
          launchAccepted: false,
          transitions: Object.freeze([
            Object.freeze({
              state: "queued",
              occurredAt: "2026-03-31T00:00:00.000Z",
              message: "Execution request accepted and queued.",
            }),
            Object.freeze({
              state: "failed",
              occurredAt: "2026-03-31T00:00:01.000Z",
              message: "Workflow execution validation failed before launch.",
            }),
          ]),
          failure: Object.freeze({
            kind: "validation-failure",
            code: "trigger-malformed",
            message: "Workflow execution validation failed before launch.",
            stage: "validation",
          }),
        }),
        validation: Object.freeze({
          ready: false,
          authoredValidation: Object.freeze({
            ready: true,
            blockingIssueCount: 0,
            warningIssueCount: 0,
          }),
          preExecutionValidation: Object.freeze({
            ready: false,
            blockingIssueCount: 1,
            warningIssueCount: 0,
          }),
          translationValidation: Object.freeze({
            ready: false,
            blockingIssueCount: 1,
            warningIssueCount: 0,
          }),
          issues: Object.freeze([
            Object.freeze({
              code: "trigger-malformed",
              stage: "pre-translation",
              severity: "error",
              category: "trigger",
              blocking: true,
              message: "Temporal trigger requires runAt or recurring schedule.",
            }),
          ]),
          blockingIssueCount: 1,
          warningIssueCount: 0,
        }),
      }),
    });

    const html = renderToStaticMarkup(
      <WorkflowStudioExecutionFeedbackPanel
        readiness={runFeedback.result?.validation}
        runFeedback={runFeedback}
      />,
    );

    expect(html).toContain("Not ready");
    expect(html).toContain("Validation: 1 blocking, 0 warning issue(s).");
    expect(html).toContain("trigger-malformed");
    expect(html).toContain("Launch status");
    expect(html).toContain("blocked");
    expect(html).toContain("Execution state: failed (not accepted)");
    expect(html).toContain("Failure: [validation-failure]");
  });

  it("renders result handoff summary when runtime output delivery is available", () => {
    const runFeedback: WorkflowStudioRunFeedback = Object.freeze({
      status: "launched",
      message: "Workflow launch started successfully. Runtime status: completed.",
      result: Object.freeze({
        launchStatus: "launched",
        execution: Object.freeze({
          executionId: "exec-2",
          state: "completed",
          launchAccepted: true,
          transitions: Object.freeze([]),
        }),
        validation: Object.freeze({
          ready: true,
          authoredValidation: Object.freeze({
            ready: true,
            blockingIssueCount: 0,
            warningIssueCount: 0,
          }),
          preExecutionValidation: Object.freeze({
            ready: true,
            blockingIssueCount: 0,
            warningIssueCount: 0,
          }),
          translationValidation: Object.freeze({
            ready: true,
            blockingIssueCount: 0,
            warningIssueCount: 0,
          }),
          issues: Object.freeze([]),
          blockingIssueCount: 0,
          warningIssueCount: 0,
        }),
        runtime: Object.freeze({
          status: "completed",
          traceCount: 1,
          issueCount: 0,
          outputDelivery: Object.freeze({
            deliveredCount: 1,
            failedCount: 0,
            issueCount: 0,
            results: Object.freeze([
              Object.freeze({
                outputId: "output-1",
                destinationType: "web-viewer",
                target: "preview",
                status: "delivered",
              }),
            ]),
          }),
        }),
      }),
    });

    const html = renderToStaticMarkup(
      <WorkflowStudioExecutionFeedbackPanel
        readiness={runFeedback.result?.validation}
        runFeedback={runFeedback}
      />,
    );

    expect(html).toContain("Ready to run");
    expect(html).toContain("Result handoff: 1 delivered, 0 failed.");
    expect(html).toContain("output-1: web-viewer -&gt; preview (delivered)");
  });
});

