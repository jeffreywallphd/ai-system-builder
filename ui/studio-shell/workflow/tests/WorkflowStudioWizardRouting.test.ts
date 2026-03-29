import { describe, expect, it } from "bun:test";
import {
  buildWorkflowStudioWizardPagePath,
  DEFAULT_WORKFLOW_STUDIO_WIZARD_PAGE_ID,
  resolveWorkflowStudioWizardPageRoute,
  workflowStudioWizardPageDefinitions,
} from "../WorkflowStudioWizardRouting";

describe("WorkflowStudioWizardRouting", () => {
  it("exposes canonical wizard pages for trigger, inputs, steps, and outputs", () => {
    expect(workflowStudioWizardPageDefinitions.map((page) => page.id)).toEqual([
      "trigger",
      "inputs",
      "steps",
      "outputs",
    ]);
  });

  it("resolves direct wizard page routes", () => {
    const resolution = resolveWorkflowStudioWizardPageRoute({ routePageId: "steps" });

    expect(resolution.resolvedPageId).toBe("steps");
    expect(resolution.requestedPageId).toBe("steps");
    expect(resolution.source).toBe("route-param");
  });

  it("falls back to trigger page for unsupported wizard page routes", () => {
    const resolution = resolveWorkflowStudioWizardPageRoute({ routePageId: "advanced" });

    expect(resolution.resolvedPageId).toBe(DEFAULT_WORKFLOW_STUDIO_WIZARD_PAGE_ID);
    expect(resolution.invalidPageId).toBe("advanced");
    expect(resolution.source).toBe("route-param");
  });

  it("builds canonical workflow wizard page paths", () => {
    expect(buildWorkflowStudioWizardPagePath("trigger")).toBe("/studio-shell/workflow/wizard/trigger");
    expect(buildWorkflowStudioWizardPagePath("outputs")).toBe("/studio-shell/workflow/wizard/outputs");
  });
});
