import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow contract adherence", () => {
  it("workflow canvas and reactflow canvas expose declared exports", () => {
    const canvasSource = readSource("ui/components/workflow/WorkflowCanvas.tsx");
    const reactFlowCanvasSource = readSource(
      "ui/components/workflow/reactflow/ReactFlowCanvas.tsx"
    );

    expect(canvasSource).toContain("export default function WorkflowCanvas");
    expect(reactFlowCanvasSource).toContain(
      "export default function ReactFlowCanvas"
    );
  });

  it("new workflow panel modules define default React components", () => {
    const metadataPanel = readSource("ui/components/workflow/WorkflowMetadataPanel.tsx");
    const validationPanel = readSource(
      "ui/components/workflow/WorkflowValidationPanel.tsx"
    );
    const nodeList = readSource("ui/components/workflow/WorkflowNodeList.tsx");

    expect(metadataPanel).toContain("export default function WorkflowMetadataPanel");
    expect(validationPanel).toContain("export default function WorkflowValidationPanel");
    expect(nodeList).toContain("export default function WorkflowNodeList");
  });
});
