import { describe, expect, it } from "bun:test";
import {
  createStudioLaunchHandoffContract,
  parseStudioLaunchHandoffContract,
  serializeStudioLaunchHandoffContract,
  StudioLaunchHandoffOutcomeKinds,
} from "../StudioHandoffContract";

describe("StudioHandoffContract", () => {
  it("creates canonical handoff contracts with launch/origin/target/return/resume semantics", () => {
    const contract = createStudioLaunchHandoffContract({
      handoffId: "handoff:test-1",
      launchSource: "workflow-studio",
      origin: {
        studioType: "workflow-studio",
        studioId: "studio-workflows",
        route: {
          path: "/studio-shell/workflow/wizard/inputs",
          search: "?mode=wizard",
          hash: "#workflow-wizard-inputs",
        },
        workflowAuthoring: {
          modeId: "wizard",
          wizardPageId: "inputs",
          draftReference: {
            studioId: "studio-workflows",
            draftId: "draft-workflow-1",
            sessionId: "session-workflow-1",
          },
          draftState: "{\"inputs\":[]}",
        },
      },
      target: {
        selectorSessionId: "selector:workflow:inputs",
        assetType: "dataset",
        originatingField: "inputs.dataset",
        usageContext: "workflow-input",
        selectorTargetId: "workflow-inputs:dataset",
      },
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard/inputs?mode=wizard#workflow-wizard-inputs",
        contextId: "selector:workflow:inputs",
      },
      outcomes: [
        StudioLaunchHandoffOutcomeKinds.created,
        StudioLaunchHandoffOutcomeKinds.cancelled,
        StudioLaunchHandoffOutcomeKinds.noSelection,
        StudioLaunchHandoffOutcomeKinds.abandoned,
      ],
    });

    expect(contract.launch.handoffId).toBe("handoff:test-1");
    expect(contract.origin.route.path).toBe("/studio-shell/workflow/wizard/inputs");
    expect(contract.target.selector.selectorSessionId).toBe("selector:workflow:inputs");
    expect(contract.returnContract.target.routePath).toBe("/studio-shell/workflow/wizard/inputs?mode=wizard#workflow-wizard-inputs");
    expect(contract.resume.destinationRoutePath).toBe("/studio-shell/workflow/wizard/inputs?mode=wizard#workflow-wizard-inputs");
    expect(contract.returnContract.outcomes).toContain("no-selection");
    expect(contract.returnContract.outcomes).toContain("abandoned");
  });

  it("round-trips through query-safe serialization", () => {
    const contract = createStudioLaunchHandoffContract({
      handoffId: "handoff:test-2",
      launchSource: "workflow-studio",
      origin: {
        studioType: "workflow-studio",
        route: {
          path: "/studio-shell/workflow/wizard/steps",
        },
      },
      target: {
        selectorSessionId: "selector:workflow:steps",
        assetType: "agent",
      },
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard/steps",
      },
    });

    const serialized = serializeStudioLaunchHandoffContract(contract);
    const parsed = parseStudioLaunchHandoffContract(serialized);
    expect(parsed).toEqual(contract);
  });

  it("rejects malformed contracts during parse", () => {
    expect(parseStudioLaunchHandoffContract("%%%")).toBeUndefined();
  });
});

