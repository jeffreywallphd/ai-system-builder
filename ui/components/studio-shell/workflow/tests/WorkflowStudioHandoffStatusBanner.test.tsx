import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WorkflowStudioHandoffStatusBanner from "../WorkflowStudioHandoffStatusBanner";
import {
  WorkflowStudioHandoffFlowKinds,
  WorkflowStudioHandoffStatusKinds,
} from "../../../../studio-shell/workflow/WorkflowStudioHandoffStatus";

describe("WorkflowStudioHandoffStatusBanner", () => {
  it("renders completion details for dataset handoffs", () => {
    const html = renderToStaticMarkup(
      <WorkflowStudioHandoffStatusBanner
        status={{
          kind: WorkflowStudioHandoffStatusKinds.completed,
          flow: WorkflowStudioHandoffFlowKinds.datasetInput,
          updatedAt: Date.now(),
          assetDisplayName: "New dataset",
          assetId: "asset:dataset:new",
        }}
      />,
    );

    expect(html).toContain("Cross-studio handoff status");
    expect(html).toContain("Completed");
    expect(html).toContain("Added New dataset to workflow inputs.");
  });

  it("renders cancel-safe messaging for step handoffs", () => {
    const html = renderToStaticMarkup(
      <WorkflowStudioHandoffStatusBanner
        status={{
          kind: WorkflowStudioHandoffStatusKinds.cancelled,
          flow: WorkflowStudioHandoffFlowKinds.agentStep,
          updatedAt: Date.now(),
          outcomeKind: "no-selection",
        }}
      />,
    );

    expect(html).toContain("Cancelled");
    expect(html).toContain("Agent/assistant handoff ended without a selection. Draft state was preserved.");
  });
});

