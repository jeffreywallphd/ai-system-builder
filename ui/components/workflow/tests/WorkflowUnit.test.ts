import { describe, expect, it } from "bun:test";
import { expectPlaceholderModule, readSource } from "../../../tests/testUtils";

describe("ui/components/workflow unit coverage", () => {
  it("WorkflowCanvas.tsx is currently a placeholder module", () =>
    expectPlaceholderModule("ui/components/workflow/WorkflowCanvas.tsx"));

  it("WorkflowInspector.tsx is currently a placeholder module", () =>
    expectPlaceholderModule("ui/components/workflow/WorkflowInspector.tsx"));

  it("WorkflowToolbar.tsx is currently a placeholder module", () =>
    expectPlaceholderModule("ui/components/workflow/WorkflowToolbar.tsx"));

  it("defines the metadata, validation, and node-list workflow panels", () => {
    const metadataPanel = readSource(
      "ui/components/workflow/WorkflowMetadataPanel.tsx"
    );
    const validationPanel = readSource(
      "ui/components/workflow/WorkflowValidationPanel.tsx"
    );
    const nodeList = readSource("ui/components/workflow/WorkflowNodeList.tsx");

    expect(metadataPanel).toContain("Workflow Metadata");
    expect(validationPanel).toContain("Review workflow errors, warnings");
    expect(nodeList).toContain("Workflow Nodes");
  });
});
