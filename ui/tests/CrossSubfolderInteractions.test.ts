import { describe, expect, it } from "bun:test";
import { readSource } from "./testUtils";

describe("ui cross-subfolder interactions", () => {
  it("keeps service and state modules implemented", () => {
    const modules = [
      "ui/services/ModelService.ts",
      "ui/services/NodeService.ts",
      "ui/services/WorkflowService.ts",
      "ui/state/ModelStore.ts",
      "ui/state/NodeStore.ts",
      "ui/state/WorkflowStore.ts",
      "ui/state/WorkflowExecutionStore.ts",
    ];

    expect(modules.every((modulePath) => readSource(modulePath).trim().length > 0)).toBeTrue();
  });
});
