import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../tests/testUtils";

describe("ui/state unit coverage", () => {
  it("NodeStore.ts is currently a placeholder module", () => expectPlaceholderModule("ui/state/NodeStore.ts"));
  it("ModelStore.ts is currently a placeholder module", () => expectPlaceholderModule("ui/state/ModelStore.ts"));
  it("WorkflowStore.ts is currently a placeholder module", () => expectPlaceholderModule("ui/state/WorkflowStore.ts"));
});
