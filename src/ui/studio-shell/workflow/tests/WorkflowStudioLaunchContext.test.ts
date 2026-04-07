import { describe, expect, it } from "bun:test";
import { createWorkflowStudioOriginLaunchContext } from "../WorkflowStudioLaunchContext";

describe("WorkflowStudioLaunchContext", () => {
  it("builds workflow-origin launch context with route, draft, selector target, and return destination", () => {
    const contract = createWorkflowStudioOriginLaunchContext({
      handoffId: "handoff:workflow:dataset",
      routePath: "/studio-shell/workflow/wizard/inputs",
      routeSearch: "?mode=wizard&draftId=draft-workflow-1",
      routeHash: "#workflow-wizard-inputs",
      returnRoutePath: "/studio-shell/workflow/wizard/inputs?mode=wizard&draftId=draft-workflow-1#workflow-wizard-inputs",
      selectorTarget: {
        selectorSessionId: "selector:workflow:inputs",
        assetType: "dataset",
        originatingField: "inputs.dataset",
        usageContext: "workflow-input",
        selectorTargetId: "workflow-inputs:dataset",
      },
      workflow: {
        studioId: "studio-workflows",
        modeId: "wizard",
        wizardPageId: "inputs",
        draftReference: {
          studioId: "studio-workflows",
          draftId: "draft-workflow-1",
          sessionId: "session-workflow-1",
          assetId: "asset:workflow:1",
          versionId: "asset:workflow:1:v1",
        },
        draftState: "{\"triggers\":[],\"inputs\":[],\"steps\":[],\"outputs\":[]}",
      },
    });

    expect(contract.origin.studioType).toBe("workflow-studio");
    expect(contract.origin.route.path).toBe("/studio-shell/workflow/wizard/inputs");
    expect(contract.origin.workflowAuthoring?.draftReference?.draftId).toBe("draft-workflow-1");
    expect(contract.origin.workflowAuthoring?.draftState).toContain("\"inputs\"");
    expect(contract.target.selector.selectorTargetId).toBe("workflow-inputs:dataset");
    expect(contract.returnContract.target.routePath).toBe("/studio-shell/workflow/wizard/inputs?mode=wizard&draftId=draft-workflow-1#workflow-wizard-inputs");
    expect(contract.resume.destinationRoutePath).toBe("/studio-shell/workflow/wizard/inputs?mode=wizard&draftId=draft-workflow-1#workflow-wizard-inputs");
  });
});

