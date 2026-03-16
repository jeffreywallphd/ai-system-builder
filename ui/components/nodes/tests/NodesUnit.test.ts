import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../../tests/testUtils";

describe("ui/components/nodes unit coverage", () => {
  it("NodeComponent.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/nodes/NodeComponent.tsx"));
  it("NodePortView.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/nodes/NodePortView.tsx"));
  it("NodePropertyEditor.tsx is currently a placeholder module", () => expectPlaceholderModule("ui/components/nodes/NodePropertyEditor.tsx"));
});
