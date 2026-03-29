import { describe, expect, it } from "bun:test";
import { resolveWorkflowStudioModeRoute } from "../WorkflowStudioModeRouting";
import { DEFAULT_WORKFLOW_STUDIO_MODE_ID } from "../WorkflowStudioModes";

describe("WorkflowStudioModeRouting", () => {
  it("resolves direct route mode parameters for deep-linked workflow mode routes", () => {
    const resolution = resolveWorkflowStudioModeRoute({ routeModeId: "wizard" });

    expect(resolution.resolvedModeId).toBe("wizard");
    expect(resolution.requestedModeId).toBe("wizard");
    expect(resolution.source).toBe("route-param");
    expect(resolution.invalidModeId).toBeUndefined();
  });

  it("resolves query mode parameters when route mode parameter is absent", () => {
    const resolution = resolveWorkflowStudioModeRoute({ search: "?mode=canvas" });

    expect(resolution.resolvedModeId).toBe("canvas");
    expect(resolution.requestedModeId).toBe("canvas");
    expect(resolution.source).toBe("query-param");
    expect(resolution.invalidModeId).toBeUndefined();
  });

  it("resolves to the default workflow mode when no explicit mode is supplied", () => {
    const resolution = resolveWorkflowStudioModeRoute({ search: "" });

    expect(resolution.resolvedModeId).toBe(DEFAULT_WORKFLOW_STUDIO_MODE_ID);
    expect(resolution.requestedModeId).toBeUndefined();
    expect(resolution.invalidModeId).toBeUndefined();
    expect(resolution.source).toBe("none");
  });

  it("handles unsupported mode routes safely without selecting an invalid mode", () => {
    const resolution = resolveWorkflowStudioModeRoute({ routeModeId: "advanced" });

    expect(resolution.resolvedModeId).toBe(DEFAULT_WORKFLOW_STUDIO_MODE_ID);
    expect(resolution.requestedModeId).toBeUndefined();
    expect(resolution.invalidModeId).toBe("advanced");
    expect(resolution.source).toBe("route-param");
  });
});
