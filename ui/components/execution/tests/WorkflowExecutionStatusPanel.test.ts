import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import WorkflowExecutionStatusPanel from "../WorkflowExecutionStatusPanel";

describe("WorkflowExecutionStatusPanel", () => {
  it("renders workflow status details", () => {
    const html = renderToStaticMarkup(
      React.createElement(WorkflowExecutionStatusPanel, {
        executionId: "exec-1",
        status: "running",
        currentNodeId: "node-a",
        progressPercent: 45,
        message: "Running step",
      })
    );

    expect(html).toContain("Workflow Execution");
    expect(html).toContain("exec-1");
    expect(html).toContain("45%");
  });
});
