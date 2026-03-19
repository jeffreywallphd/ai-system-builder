import { describe, expect, it } from "bun:test";
import { importModule } from "../../tests/testUtils";

describe("ui/services contract adherence", () => {
  it("exports service classes and options types at runtime", async () => {
    const nodeModule = await importModule("ui/services/NodeService.ts");
    const modelModule = await importModule("ui/services/ModelService.ts");
    const workflowModule = await importModule("ui/services/WorkflowService.ts");
    const mcpModule = await importModule("ui/services/McpService.ts");

    expect(Object.keys(nodeModule)).toContain("NodeService");
    expect(Object.keys(modelModule)).toContain("ModelService");
    expect(Object.keys(workflowModule)).toContain("WorkflowService");
    expect(Object.keys(mcpModule)).toContain("McpService");
  });
});
