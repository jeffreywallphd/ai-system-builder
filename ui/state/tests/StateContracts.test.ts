import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/state contract adherence", () => {
  it("exports store classes at runtime", async () => {
    const nodeModule = await importModule("ui/state/NodeStore.ts");
    const modelModule = await importModule("ui/state/ModelStore.ts");
    const workflowModule = await importModule("ui/state/WorkflowStore.ts");

    expect(Object.keys(nodeModule)).toContain("NodeStore");
    expect(Object.keys(modelModule)).toContain("ModelStore");
    expect(Object.keys(workflowModule)).toContain("WorkflowStore");
  });
});
