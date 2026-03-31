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

  it("builds workflow-aware run routes with stable workflow entry query context", () => {
    expect(buildWorkflowStudioRunHistoryPath({
      workflowId: "workflow:persisted:1",
      workflowStatus: "draft",
    })).toContain("/studio-shell/workflow/runs?");
    expect(buildWorkflowStudioRunHistoryPath({
      workflowId: "workflow:persisted:1",
      workflowStatus: "draft",
    })).toContain("workflowEntry=resume-draft");
    expect(buildWorkflowStudioRunDetailPath("run:workflow:1", {
      workflowId: "workflow:persisted:1",
      workflowStatus: "saved",
    })).toContain("workflowEntry=open-existing");
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
