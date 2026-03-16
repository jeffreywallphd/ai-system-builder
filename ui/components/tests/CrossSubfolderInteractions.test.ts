import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/components cross-subfolder interactions", () => {
  it("keeps active modules implemented while placeholders remain explicitly empty", () => {
    const implemented = [
      "ui/components/models/ModelBrowser.tsx",
      "ui/components/nodes/NodePropertyEditor.tsx",
      "ui/components/workflow/WorkflowCanvas.tsx",
    ];
    const placeholders = [
      "ui/components/models/ModelInstaller.tsx",
      "ui/components/nodes/NodeComponent.tsx",
      "ui/components/nodes/NodePortView.tsx",
      "ui/components/workflow/WorkflowInspector.tsx",
      "ui/components/workflow/WorkflowToolbar.tsx",
    ];

    expect(
      implemented.every((modulePath) => readSource(modulePath).trim().length > 0)
    ).toBeTrue();
    expect(
      placeholders.every((modulePath) => readSource(modulePath).trim().length === 0)
    ).toBeTrue();
  });
});
