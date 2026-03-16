import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/workflow contract adherence", () => {
  it("workflow canvas and drag hook expose declared exports", () => {
    const canvasSource = readSource("ui/components/workflow/WorkflowCanvas.tsx");
    const dragSource = readSource("ui/components/workflow/useNodeDrag.ts");

    expect(canvasSource).toContain("export default function WorkflowCanvas");
    expect(dragSource).toContain("export function useNodeDrag");
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
