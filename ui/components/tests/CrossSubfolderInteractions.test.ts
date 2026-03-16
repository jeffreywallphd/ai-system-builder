import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("ui/components cross-subfolder interactions", () => {
  it("keeps all component modules in a coherent placeholder state", () => {
    const modules = [
      "ui/components/models/ModelBrowser.tsx",
      "ui/components/models/ModelInstaller.tsx",
      "ui/components/nodes/NodeComponent.tsx",
      "ui/components/nodes/NodePortView.tsx",
      "ui/components/nodes/NodePropertyEditor.tsx",
      "ui/components/workflow/WorkflowCanvas.tsx",
      "ui/components/workflow/WorkflowInspector.tsx",
      "ui/components/workflow/WorkflowToolbar.tsx",
    ];

    expect(modules.every((modulePath) => readSource(modulePath).trim() === "")).toBeTrue();
  });
});
