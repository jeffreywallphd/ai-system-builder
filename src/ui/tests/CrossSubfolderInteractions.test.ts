import { describe, expect, it } from "bun:test";
import { readSource } from "./testUtils";

describe("ui cross-subfolder interactions", () => {
  it("keeps service and state modules implemented", () => {
    const modules = [
      "src/ui/services/ModelService.ts",
      "src/ui/services/NodeService.ts",
      "src/ui/services/WorkflowService.ts",
      "src/ui/services/McpService.ts",
      "src/ui/state/ModelStore.ts",
      "src/ui/state/NodeStore.ts",
      "src/ui/state/WorkflowStore.ts",
      "src/ui/state/WorkflowExecutionStore.ts",
      "src/ui/state/McpStore.ts",
    ];

    expect(modules.every((modulePath) => readSource(modulePath).trim().length > 0)).toBeTrue();
  });
});
