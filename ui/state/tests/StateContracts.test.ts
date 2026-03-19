import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/state contract adherence", () => {
  it("exports store classes at runtime", async () => {
    const nodeModule = await importModule("ui/state/NodeStore.ts");
    const modelModule = await importModule("ui/state/ModelStore.ts");
    const workflowModule = await importModule("ui/state/WorkflowStore.ts");
    const executionModule = await importModule("ui/state/WorkflowExecutionStore.ts");
    const mcpModule = await importModule("ui/state/McpStore.ts");

    expect(Object.keys(nodeModule)).toContain("NodeStore");
    expect(Object.keys(modelModule)).toContain("ModelStore");
    expect(Object.keys(workflowModule)).toContain("WorkflowStore");
    expect(Object.keys(executionModule)).toContain("WorkflowExecutionStore");
    expect(Object.keys(mcpModule)).toContain("McpStore");
  });
});
