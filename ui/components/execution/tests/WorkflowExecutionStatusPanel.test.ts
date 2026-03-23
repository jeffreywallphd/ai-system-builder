import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import WorkflowExecutionStatusPanel from "../WorkflowExecutionStatusPanel";

describe("WorkflowExecutionStatusPanel", () => {
  it("renders workflow status details from the execution view model", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkflowExecutionStatusPanel, {
        viewModel: {
          executionId: "exec-1",
          statusLabel: "Running",
          statusTone: "info",
          currentNodeLabel: "node-a",
          progressLabel: "45%",
          executionPathLabel: "Delegated",
          message: "Running step",
          detail: "Delegated to the runtime.",
          selectionReason: "Matched requested runtime.",
          outputSummary: "1 output asset captured.",
        },
      })
    );

    expect(html).toContain("Workflow Execution");
    expect(html).toContain("exec-1");
    expect(html).toContain("45%");
    expect(html).toContain("Matched requested runtime.");
    expect(html).toContain("1 output asset captured.");
  });
});
