import { describe, expect, it } from "bun:test";
import { importModule, readSource } from "../../../tests/testUtils";

describe("ui/components/workflow contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(
      Object.keys(await importModule("ui/components/workflow/WorkflowCanvas.tsx"))
    ).toEqual([]);
    expect(
      Object.keys(await importModule("ui/components/workflow/WorkflowInspector.tsx"))
    ).toEqual([]);
    expect(
      Object.keys(await importModule("ui/components/workflow/WorkflowToolbar.tsx"))
    ).toEqual([]);
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
