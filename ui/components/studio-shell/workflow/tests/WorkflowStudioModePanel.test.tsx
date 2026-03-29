import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkflowStudioModePanel from "../WorkflowStudioModePanel";
import { WorkflowStudioModeStateStore } from "../../../../studio-shell/workflow/WorkflowStudioModeStateStore";

describe("WorkflowStudioModePanel", () => {
  it("renders active mode and shared draft summary from centralized workflow mode state", () => {
    const store = new WorkflowStudioModeStateStore();
    const html = renderToStaticMarkup(
      <WorkflowStudioModePanel
        workflowModeState={{
          state: store.getState(),
          setSelectedMode: (modeId) => store.setSelectedMode(modeId),
        }}
      />,
    );

    expect(html).toContain("Workflow authoring mode");
    expect(html).toContain("Canvas");
    expect(html).toContain("Wizard");
    expect(html).toContain("Shared draft");
    expect(html).toContain("Shared draft valid");
    expect(html).toContain("Mode validation issues");
    expect(html).toContain("Draft validation issues");
    expect(html).toContain('aria-pressed="true"');
  });
});
