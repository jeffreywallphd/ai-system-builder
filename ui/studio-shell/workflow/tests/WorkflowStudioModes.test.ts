import { describe, expect, it } from "bun:test";
import {
  createDefaultWorkflowStudioModeRegistry,
  DEFAULT_WORKFLOW_STUDIO_MODE_ID,
  defaultWorkflowStudioModes,
  WorkflowStudioModeIds,
  WorkflowStudioModeRegistry,
} from "../WorkflowStudioModes";

describe("WorkflowStudioModes", () => {
  it("registers wizard and canvas modes in the default mode catalog", () => {
    const registry = createDefaultWorkflowStudioModeRegistry();

    expect(defaultWorkflowStudioModes.map((mode) => mode.id)).toEqual([
      WorkflowStudioModeIds.canvas,
      WorkflowStudioModeIds.wizard,
    ]);
    expect(registry.get(WorkflowStudioModeIds.canvas)?.intent).toBe("graph-authoring");
    expect(registry.get(WorkflowStudioModeIds.wizard)?.intent).toBe("guided-authoring");
    expect(DEFAULT_WORKFLOW_STUDIO_MODE_ID).toBe(WorkflowStudioModeIds.wizard);
  });

  it("supports explicit registry extension while preventing duplicate mode ids", () => {
    const registry = new WorkflowStudioModeRegistry();
    registry.registerMany(defaultWorkflowStudioModes);

    expect(() => registry.register(defaultWorkflowStudioModes[0]!)).toThrow("already registered");
  });
});
