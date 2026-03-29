import { describe, expect, it } from "bun:test";
import { InlineAssetCreationService, InlineAssetReturnStatuses } from "../../../routes/InlineAssetCreation";
import { serializeStudioLaunchHandoffContract } from "../../../routes/StudioHandoffContract";
import { createWorkflowStudioOriginLaunchContext } from "../WorkflowStudioLaunchContext";
import { WorkflowStudioModeStateStore } from "../WorkflowStudioModeStateStore";
import { WorkflowStudioReturnRestorationService } from "../WorkflowStudioReturnRestorationService";

describe("WorkflowStudioReturnRestorationService", () => {
  it("restores workflow mode and draft snapshot from handoff origin context", () => {
    const store = new WorkflowStudioModeStateStore();
    const inlineCreationService = new InlineAssetCreationService();
    const handoff = createWorkflowStudioOriginLaunchContext({
      handoffId: "handoff:restore:workflow",
      routePath: "/studio-shell/workflow/wizard/steps",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-steps",
      returnRoutePath: "/studio-shell/workflow/wizard/steps?mode=wizard",
      selectorTarget: {
        selectorSessionId: "selector:workflow:steps",
        assetType: "agent",
        selectorTargetId: "workflow-step:new",
      },
      workflow: {
        studioId: "studio-workflows",
        modeId: "wizard",
        wizardPageId: "steps",
        draftReference: {
          studioId: "studio-workflows",
          sessionId: "session-workflow-1",
          draftId: "draft-workflow-1",
        },
        draftState: "{\"triggers\":[{\"id\":\"trigger-restored\",\"kind\":\"user\",\"type\":\"manual\",\"config\":{}}]}",
      },
    });
    const returnPath = inlineCreationService.buildReturnPath({
      returnTarget: {
        routePath: `/studio-shell/workflow/wizard/steps?studioHandoff=${serializeStudioLaunchHandoffContract(handoff)}`,
        contextId: "selector:workflow:steps",
      },
      payload: {
        status: InlineAssetReturnStatuses.created,
        assetId: "asset:agent:new",
        assetType: "agent",
      },
    });

    const query = returnPath.split("?")[1] ?? "";
    const service = new WorkflowStudioReturnRestorationService();
    const outcome = service.restoreFromReturnSearch({
      search: `?${query}`,
      workflowModeStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.restored).toBeTrue();
    expect(store.getState().selectedModeId).toBe("wizard");
    expect(store.getState().sharedDraft.triggers.map((entry) => entry.id)).toEqual(["trigger-restored"]);
    expect(store.getState().draftSyncContext).toEqual({
      studioId: "studio-workflows",
      sessionId: "session-workflow-1",
      draftId: "draft-workflow-1",
      revision: undefined,
    });
  });

  it("ignores stale restoration payloads that target a different workflow draft context", () => {
    const store = new WorkflowStudioModeStateStore();
    store.setDraftSyncContext({
      studioId: "studio-workflows",
      sessionId: "session-workflow-current",
      draftId: "draft-workflow-current",
    });
    const inlineCreationService = new InlineAssetCreationService();
    const handoff = createWorkflowStudioOriginLaunchContext({
      handoffId: "handoff:restore:stale",
      routePath: "/studio-shell/workflow/wizard/steps",
      returnRoutePath: "/studio-shell/workflow/wizard/steps?mode=wizard",
      selectorTarget: {
        selectorSessionId: "selector:workflow:steps",
        assetType: "agent",
      },
      workflow: {
        studioId: "studio-workflows",
        modeId: "wizard",
        wizardPageId: "steps",
        draftReference: {
          studioId: "studio-workflows",
          sessionId: "session-workflow-other",
          draftId: "draft-workflow-other",
        },
        draftState: "{\"steps\":[{\"id\":\"step-stale\",\"type\":\"action\",\"kind\":\"action\",\"order\":1}]}",
      },
    });
    const returnPath = inlineCreationService.buildReturnPath({
      returnTarget: {
        routePath: `/studio-shell/workflow/wizard/steps?studioHandoff=${serializeStudioLaunchHandoffContract(handoff)}`,
        contextId: "selector:workflow:steps",
      },
      payload: {
        status: InlineAssetReturnStatuses.created,
        assetId: "asset:agent:new",
        assetType: "agent",
      },
    });

    const query = returnPath.split("?")[1] ?? "";
    const service = new WorkflowStudioReturnRestorationService();
    const outcome = service.restoreFromReturnSearch({
      search: `?${query}`,
      workflowModeStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.restored).toBeFalse();
    expect(outcome.ignoredReason).toBe("draft-context-mismatch");
    expect(store.getState().draftSyncContext).toEqual({
      studioId: "studio-workflows",
      sessionId: "session-workflow-current",
      draftId: "draft-workflow-current",
      revision: undefined,
    });
    expect(store.getState().sharedDraft.steps).toHaveLength(0);
  });
});
