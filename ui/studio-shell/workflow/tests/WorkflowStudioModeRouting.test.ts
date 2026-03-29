import { describe, expect, it } from "bun:test";
import { resolveWorkflowStudioModeRoute } from "../WorkflowStudioModeRouting";

describe("WorkflowStudioModeRouting", () => {
  it("resolves direct route mode parameters for deep-linked workflow mode routes", () => {
    const resolution = resolveWorkflowStudioModeRoute({ routeModeId: "wizard" });

    expect(resolution.requestedModeId).toBe("wizard");
    expect(resolution.source).toBe("route-param");
    expect(resolution.invalidModeId).toBeUndefined();
  });

  it("resolves query mode parameters when route mode parameter is absent", () => {
    const resolution = resolveWorkflowStudioModeRoute({ search: "?mode=canvas" });

    expect(resolution.requestedModeId).toBe("canvas");
    expect(resolution.source).toBe("query-param");
    expect(resolution.invalidModeId).toBeUndefined();
  });

  it("handles unsupported mode routes safely without selecting an invalid mode", () => {
    const resolution = resolveWorkflowStudioModeRoute({ routeModeId: "advanced" });

    expect(resolution.requestedModeId).toBeUndefined();
    expect(resolution.invalidModeId).toBe("advanced");
    expect(resolution.source).toBe("route-param");
  });
});
