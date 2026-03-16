import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../../tests/testUtils";

describe("ui/components/workflow unit coverage", () => {
  it("WorkflowCanvas.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/workflow/WorkflowCanvas.tsx"));
  it("WorkflowInspector.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/workflow/WorkflowInspector.tsx"));
  it("WorkflowToolbar.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/workflow/WorkflowToolbar.tsx"));
});
