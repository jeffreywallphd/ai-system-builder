import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow unit coverage", () => {
  it("defines canvas, metadata, validation, and node-list workflow modules", () => {
    const canvas = readSource("ui/components/workflow/WorkflowCanvas.tsx");
    const metadataPanel = readSource(
      "ui/components/workflow/WorkflowMetadataPanel.tsx"
    );
    const validationPanel = readSource(
      "ui/components/workflow/WorkflowValidationPanel.tsx"
    );
    const nodeList = readSource("ui/components/workflow/WorkflowNodeList.tsx");

    expect(canvas).toContain("export default function WorkflowCanvas");
    expect(metadataPanel).toContain("Workflow Metadata");
    expect(validationPanel).toContain("Review workflow errors, warnings");
    expect(nodeList).toContain("Workflow Nodes");
  });

  it("implements a reusable useNodeDrag hook", () => {
    const source = readSource("ui/components/workflow/useNodeDrag.ts");

    expect(source).toContain("export function useNodeDrag");
    expect(source).toContain("window.addEventListener(\"pointermove\"");
    expect(source).toContain("data-node-drag-ignore='true'");
  });
});
