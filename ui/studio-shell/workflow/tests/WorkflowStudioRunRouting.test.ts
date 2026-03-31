import { describe, expect, it } from "bun:test";
import {
  buildWorkflowStudioRunDetailPath,
  buildWorkflowStudioRunHistoryPath,
  resolveWorkflowStudioRunRoute,
} from "../WorkflowStudioRunRouting";

describe("WorkflowStudioRunRouting", () => {
  it("builds canonical workflow studio run history and detail paths", () => {
    expect(buildWorkflowStudioRunHistoryPath()).toBe("/studio-shell/workflow/runs");
    expect(buildWorkflowStudioRunDetailPath("run:workflow:1")).toBe("/studio-shell/workflow/runs/run%3Aworkflow%3A1");
  });

  it("resolves normalized run route state from route parameters", () => {
    const withRun = resolveWorkflowStudioRunRoute({ runId: " run:1 " });
    expect(withRun.runId).toBe("run:1");
    expect(withRun.isRunRoute).toBeTrue();

    const withoutRun = resolveWorkflowStudioRunRoute({ runId: undefined });
    expect(withoutRun.runId).toBeUndefined();
    expect(withoutRun.isRunRoute).toBeFalse();
  });
});
