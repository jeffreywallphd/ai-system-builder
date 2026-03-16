import { describe, it } from "bun:test";
import { expectPlaceholderModule } from "../../tests/testUtils";

describe("ui/services unit coverage", () => {
  it("NodeService.ts is currently a placeholder module", () => expectPlaceholderModule("ui/services/NodeService.ts"));
  it("ModelService.ts is currently a placeholder module", () => expectPlaceholderModule("ui/services/ModelService.ts"));
  it("WorkflowService.ts is currently a placeholder module", () => expectPlaceholderModule("ui/services/WorkflowService.ts"));
});
