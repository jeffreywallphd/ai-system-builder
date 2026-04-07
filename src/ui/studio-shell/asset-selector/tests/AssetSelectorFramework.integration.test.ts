import { describe, expect, it } from "bun:test";
import {
  WorkflowDraftBuiltInStepTypes,
  createEmptyWorkflowDraft,
  deserializeWorkflowDraft,
  serializeWorkflowDraft,
} from "../../../../domain/workflow-studio/WorkflowStudioDomain";
import { createAssetSelectorRequest, AssetSelectorSelectionModes, AssetSelectorSelectionTypes } from "../../../../domain/studio-shell/AssetSelectorContract";
import { AssetSelectorSessionStore } from "../../../../application/studio-entry/AssetSelectorSessionStore";
import { AssetSelectorUsageContexts } from "../../../../application/studio-entry/AssetSelectorCapabilityRegistry";
import {
  createDatasetAssetSelectorRequest,
} from "../DatasetAssetSelectorAdapter";
import {
  createAgentAssistantAssetSelectorRequest,
} from "../AgentAssistantAssetSelectorAdapter";
import { AssetSelectorStudioLaunchService } from "../AssetSelectorStudioLaunchService";
import { AssetSelectorReturnHandoffService } from "../AssetSelectorReturnHandoffService";
import { InlineAssetCreationService } from "../../../routes/InlineAssetCreation";
import { listDatasetInputs, replaceDatasetInputSelections } from "../../workflow/WorkflowWizardDatasetInputs";
import {
  addWorkflowStep,
  buildWorkflowStepTypeDefinitionKey,
  setWorkflowStepAgentAssetSelection,
  setWorkflowStepType,
  workflowStepTypeDefinitions,
} from "../../workflow/WorkflowWizardSteps";

function readSearchFromPath(path: string): string {
  const query = path.split("?")[1];
  if (!query) {
    return "";
  }
  return `?${query.split("#")[0]}`;
}

describe("AssetSelectorFramework integration", () => {
  it("enforces selector contract and capability matrix together at session boundaries", () => {
    const store = new AssetSelectorSessionStore();
    const invalidRequest = createAssetSelectorRequest({
      requestId: "selector:invalid-capability",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { minSelections: 0, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "steps.agent-assistant",
        usageContext: AssetSelectorUsageContexts.workflowStep,
      },
    });

    expect(() => store.prepareSession({
      sessionKey: "workflow-studio:invalid",
      request: invalidRequest,
    })).toThrow("invalid-asset-type");
  });

  it("keeps dataset and agent selectors isolated while preserving workflow draft state", () => {
    const store = new AssetSelectorSessionStore();
    const datasetRequest = createDatasetAssetSelectorRequest({
      requestId: "selector:workflow:dataset",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });
    const agentRequest = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow:agent",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });

    store.prepareSession({ sessionKey: "workflow:inputs", request: datasetRequest });
    store.prepareSession({ sessionKey: "workflow:steps", request: agentRequest });
    store.activateSession("workflow:inputs");
    store.activateSession("workflow:steps");

    store.setPendingSelections("workflow:inputs", [{
      assetId: "asset:dataset:customers",
      versionId: "asset:dataset:customers:v2",
      assetType: "dataset",
      displayName: "Customers",
    }, {
      assetId: "asset:dataset:orders",
      versionId: "asset:dataset:orders:v1",
      assetType: "dataset",
      displayName: "Orders",
    }]);
    store.confirmPendingSelections("workflow:inputs");

    store.setPendingSelections("workflow:steps", [{
      assetId: "asset:agent:planner",
      versionId: "asset:agent:planner:v1",
      assetType: "agent",
      displayName: "Planner",
    }]);
    store.confirmPendingSelections("workflow:steps");

    const datasetSession = store.getSession("workflow:inputs");
    const stepSession = store.getSession("workflow:steps");
    expect(datasetSession?.selectedAssets.map((entry) => entry.assetId)).toEqual([
      "asset:dataset:customers",
      "asset:dataset:orders",
    ]);
    expect(stepSession?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:agent:planner"]);

    let draft = createEmptyWorkflowDraft();
    draft = replaceDatasetInputSelections(draft, datasetSession?.selectedAssets.map((entry) => ({
      assetId: entry.assetId,
      versionId: entry.versionId,
      name: entry.displayName,
    })) ?? []).draft;
    const addedStep = addWorkflowStep(draft);
    draft = setWorkflowStepAgentAssetSelection(addedStep.draft, addedStep.stepId, {
      assetId: stepSession?.selectedAssets[0]?.assetId ?? "",
      versionId: stepSession?.selectedAssets[0]?.versionId,
      name: stepSession?.selectedAssets[0]?.displayName,
    }).draft;

    expect(listDatasetInputs(draft).map((entry) => entry.asset.assetId)).toEqual([
      "asset:dataset:customers",
      "asset:dataset:orders",
    ]);
    expect(draft.steps[0]?.assetRef?.asset.assetId).toBe("asset:agent:planner");
  });

  it("restores the correct selector session after create-new handoff return", () => {
    const sessionKey = "workflow-studio:demo:inputs:dataset";
    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:workflow:inputs:return",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });
    const store = new AssetSelectorSessionStore();
    const launchService = new AssetSelectorStudioLaunchService();
    const returnService = new AssetSelectorReturnHandoffService();
    const inlineService = new InlineAssetCreationService();

    store.prepareSession({
      sessionKey,
      request,
      initialSelectedAssets: [{
        assetId: "asset:dataset:existing",
        versionId: "asset:dataset:existing:v1",
        assetType: "dataset",
      }],
    });
    store.activateSession(sessionKey);

    const launch = launchService.launch({
      sessionKey,
      selectorRequest: request,
      routePath: "/studio-shell/workflow/wizard",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-inputs",
    });
    expect(launch).toBeDefined();
    expect(launch?.launchPath).toContain("selectorLaunch=1");
    expect(launch?.launchPath).toContain(`selectorSessionId=${encodeURIComponent(sessionKey)}`);
    expect(launch?.launchPath).toContain("studioHandoff=");

    store.transitionToCreatingNew(sessionKey, {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: sessionKey,
      returnRoutePath: launch?.returnTarget?.routePath,
    });

    const returnPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: launch?.returnTarget?.routePath ?? "/studio-shell/workflow/wizard?mode=wizard",
        contextId: sessionKey,
      },
      payload: {
        status: "created",
        assetId: "asset:dataset:newly-created",
        versionId: "asset:dataset:newly-created:v1",
        assetType: "dataset",
        displayName: "Newly created dataset",
      },
    });

    const outcome = returnService.handle({
      search: readSearchFromPath(returnPath),
      sessionKey,
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.returnedAsset?.assetId).toBe("asset:dataset:newly-created");

    const session = store.getSession(sessionKey);
    expect(session?.lifecycleState).toBe("active");
    expect(session?.selectedAssets.map((entry) => entry.assetId)).toEqual([
      "asset:dataset:existing",
      "asset:dataset:newly-created",
    ]);
  });

  it("applies returned agent assets to the intended workflow step target and keeps prior draft state", () => {
    const sessionKey = "workflow-studio:demo:steps:agent-assistant";
    const request = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow:steps:return",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });
    const store = new AssetSelectorSessionStore();
    const launchService = new AssetSelectorStudioLaunchService();
    const returnService = new AssetSelectorReturnHandoffService();
    const inlineService = new InlineAssetCreationService();

    store.prepareSession({
      sessionKey,
      request,
    });
    store.activateSession(sessionKey);

    let draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([Object.freeze({
        id: "trigger-1",
        kind: "user" as const,
        type: "manual" as const,
        config: Object.freeze({}),
      })]),
      inputs: Object.freeze([Object.freeze({
        id: "input-1",
        type: "dataset-input",
        title: "Dataset",
        sourceType: "dataset-asset" as const,
        asset: Object.freeze({ assetId: "asset:dataset:customers" }),
      })]),
      outputs: Object.freeze([Object.freeze({
        id: "output-1",
        type: "result",
        outputType: "document" as const,
        format: "json" as const,
        destination: Object.freeze({
          type: "web-viewer" as const,
          target: "preview",
        }),
        title: "Result",
      })]),
    });
    draft = addWorkflowStep(draft).draft;
    draft = addWorkflowStep(draft).draft;
    const replaceStepId = draft.steps[1]?.id as string;
    draft = setWorkflowStepAgentAssetSelection(draft, replaceStepId, {
      assetId: "asset:agent:existing",
      versionId: "asset:agent:existing:v1",
      name: "Existing Agent",
    }).draft;
    const delayDefinition = workflowStepTypeDefinitions.find(
      (entry) => entry.type === WorkflowDraftBuiltInStepTypes.delayWait,
    );
    if (!delayDefinition) {
      throw new Error("Missing delay step definition.");
    }
    draft = setWorkflowStepType(
      draft,
      draft.steps[0]?.id as string,
      buildWorkflowStepTypeDefinitionKey(delayDefinition),
    ).draft;

    const launch = launchService.launch({
      sessionKey,
      selectorRequest: request,
      routePath: "/studio-shell/workflow/wizard/steps",
      routeSearch: `?workflowStepSelectorTarget=${replaceStepId}`,
      routeHash: "#workflow-wizard-steps",
      selectorTargetId: `workflow-step:${replaceStepId}`,
      workflowOrigin: {
        studioId: "studio-workflows",
        modeId: "wizard",
        wizardPageId: "steps",
        draftState: serializeWorkflowDraft(draft),
      },
    });
    expect(launch).toBeDefined();

    store.transitionToCreatingNew(sessionKey, {
      originatingContext: request.context,
      requestedAssetType: "agent",
      returnTargetSessionKey: sessionKey,
      returnRoutePath: launch?.returnTarget?.routePath,
    });

    const createdReturnPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: launch?.returnTarget?.routePath ?? "/studio-shell/workflow/wizard/steps",
        contextId: sessionKey,
      },
      payload: {
        status: "created",
        assetId: "asset:agent:new",
        versionId: "asset:agent:new:v1",
        assetType: "agent",
        displayName: "New Agent",
      },
    });

    const createdOutcome = returnService.handle({
      search: readSearchFromPath(createdReturnPath),
      sessionKey,
      request,
      expectedSelectorTargetId: `workflow-step:${replaceStepId}`,
      expectedOriginatingField: "steps.agent-assistant",
      expectedUsageContext: "workflow-step",
      sessionStore: store,
    });
    expect(createdOutcome.handled).toBeTrue();
    expect(createdOutcome.returnedAsset?.assetId).toBe("asset:agent:new");
    expect(createdOutcome.selectorTargetId).toBe(`workflow-step:${replaceStepId}`);

    const updated = setWorkflowStepAgentAssetSelection(draft, replaceStepId, {
      assetId: createdOutcome.returnedAsset?.assetId ?? "",
      versionId: createdOutcome.returnedAsset?.versionId,
      name: createdOutcome.returnedAsset?.displayName,
    }).draft;
    expect(updated.steps.find((step) => step.id === replaceStepId)?.assetRef?.asset.assetId).toBe("asset:agent:new");
    expect(updated.triggers).toEqual(draft.triggers);
    expect(updated.inputs).toEqual(draft.inputs);
    expect(updated.outputs).toEqual(draft.outputs);
    expect(updated.steps[0]?.type).toBe(WorkflowDraftBuiltInStepTypes.delayWait);

    store.transitionToCreatingNew(sessionKey, {
      originatingContext: request.context,
      requestedAssetType: "agent",
      returnTargetSessionKey: sessionKey,
      returnRoutePath: launch?.returnTarget?.routePath,
    });
    const noSelectionReturnPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: launch?.returnTarget?.routePath ?? "/studio-shell/workflow/wizard/steps",
        contextId: sessionKey,
      },
      payload: {
        status: "no-selection",
      },
    });
    const noSelectionOutcome = returnService.handle({
      search: readSearchFromPath(noSelectionReturnPath),
      sessionKey,
      request,
      expectedSelectorTargetId: `workflow-step:${replaceStepId}`,
      expectedOriginatingField: "steps.agent-assistant",
      expectedUsageContext: "workflow-step",
      sessionStore: store,
    });
    expect(noSelectionOutcome.handled).toBeTrue();
    expect(noSelectionOutcome.returnedAsset).toBeUndefined();
    expect(updated.steps.find((step) => step.id === replaceStepId)?.assetRef?.asset.assetId).toBe("asset:agent:new");
  });

  it("covers dataset launch-return-resume with cancel handling and repeated-handoff safety", () => {
    const sessionKey = "workflow-studio:demo:inputs:dataset:e2e";
    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:workflow:inputs:e2e",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });
    const store = new AssetSelectorSessionStore();
    const launchService = new AssetSelectorStudioLaunchService();
    const returnService = new AssetSelectorReturnHandoffService();
    const inlineService = new InlineAssetCreationService();

    let draft = Object.freeze({
      ...createEmptyWorkflowDraft(),
      triggers: Object.freeze([Object.freeze({
        id: "trigger-e2e",
        kind: "user" as const,
        type: "manual" as const,
        config: Object.freeze({}),
      })]),
      steps: Object.freeze([Object.freeze({
        id: "step-e2e",
        type: "action",
        kind: "action" as const,
        order: 1,
        title: "Existing Step",
      })]),
    });

    store.prepareSession({
      sessionKey,
      request,
      initialSelectedAssets: [Object.freeze({
        assetId: "asset:dataset:baseline",
        versionId: "asset:dataset:baseline:v1",
        assetType: "dataset" as const,
        displayName: "Baseline Dataset",
      })],
    });
    store.activateSession(sessionKey);

    const cancelledLaunch = launchService.launch({
      sessionKey,
      selectorRequest: request,
      routePath: "/studio-shell/workflow/wizard/inputs",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-inputs",
      selectorTargetId: "workflow-inputs:dataset",
    });
    store.transitionToCreatingNew(sessionKey, {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: sessionKey,
      returnRoutePath: cancelledLaunch?.returnTarget?.routePath,
      launchHandoffId: cancelledLaunch?.studioHandoff?.launch.handoffId,
    });

    const cancelledPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: cancelledLaunch?.returnTarget?.routePath ?? "/studio-shell/workflow/wizard/inputs",
        contextId: sessionKey,
      },
      payload: {
        status: "cancelled",
        handoffId: cancelledLaunch?.studioHandoff?.launch.handoffId,
      },
    });
    const cancelledOutcome = returnService.handle({
      search: readSearchFromPath(cancelledPath),
      sessionKey,
      request,
      expectedSelectorTargetId: "workflow-inputs:dataset",
      expectedOriginatingField: "inputs.dataset",
      expectedUsageContext: "workflow-input",
      sessionStore: store,
    });
    expect(cancelledOutcome.outcomeKind).toBe("cancelled");
    expect(store.getSession(sessionKey)?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:baseline"]);
    draft = replaceDatasetInputSelections(draft, store.getSession(sessionKey)?.selectedAssets.map((entry) => ({
      assetId: entry.assetId,
      versionId: entry.versionId,
      name: entry.displayName,
    })) ?? []).draft;
    expect(listDatasetInputs(draft).map((entry) => entry.asset.assetId)).toEqual(["asset:dataset:baseline"]);

    const createdLaunch = launchService.launch({
      sessionKey,
      selectorRequest: request,
      routePath: "/studio-shell/workflow/wizard/inputs",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-inputs",
      selectorTargetId: "workflow-inputs:dataset",
    });
    store.transitionToCreatingNew(sessionKey, {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: sessionKey,
      returnRoutePath: createdLaunch?.returnTarget?.routePath,
      launchHandoffId: createdLaunch?.studioHandoff?.launch.handoffId,
    });

    const staleReturnPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: createdLaunch?.returnTarget?.routePath ?? "/studio-shell/workflow/wizard/inputs",
        contextId: sessionKey,
      },
      payload: {
        status: "created",
        assetId: "asset:dataset:stale",
        versionId: "asset:dataset:stale:v1",
        assetType: "dataset",
        handoffId: cancelledLaunch?.studioHandoff?.launch.handoffId,
      },
    });
    const staleOutcome = returnService.handle({
      search: readSearchFromPath(staleReturnPath),
      sessionKey,
      request,
      expectedSelectorTargetId: "workflow-inputs:dataset",
      expectedOriginatingField: "inputs.dataset",
      expectedUsageContext: "workflow-input",
      sessionStore: store,
    });
    expect(staleOutcome.returnedAsset).toBeUndefined();
    expect(store.getSession(sessionKey)?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:baseline"]);

    const createdPath = inlineService.buildReturnPath({
      returnTarget: {
        routePath: createdLaunch?.returnTarget?.routePath ?? "/studio-shell/workflow/wizard/inputs",
        contextId: sessionKey,
      },
      payload: {
        status: "created",
        assetId: "asset:dataset:new",
        versionId: "asset:dataset:new:v3",
        assetType: "dataset",
        displayName: "New Dataset",
        handoffId: createdLaunch?.studioHandoff?.launch.handoffId,
      },
    });
    const createdOutcome = returnService.handle({
      search: readSearchFromPath(createdPath),
      sessionKey,
      request,
      expectedSelectorTargetId: "workflow-inputs:dataset",
      expectedOriginatingField: "inputs.dataset",
      expectedUsageContext: "workflow-input",
      sessionStore: store,
    });
    expect(createdOutcome.returnedAsset?.assetId).toBe("asset:dataset:new");

    draft = replaceDatasetInputSelections(draft, store.getSession(sessionKey)?.selectedAssets.map((entry) => ({
      assetId: entry.assetId,
      versionId: entry.versionId,
      name: entry.displayName,
    })) ?? []).draft;

    expect(listDatasetInputs(draft).map((entry) => entry.asset.assetId)).toEqual([
      "asset:dataset:baseline",
      "asset:dataset:new",
    ]);
    expect(draft.triggers).toHaveLength(1);
    expect(draft.steps).toHaveLength(1);
  });

  it("fails stale or malformed return payloads safely", () => {
    const sessionKey = "workflow-studio:demo:inputs:safe-return";
    const request = createDatasetAssetSelectorRequest({
      requestId: "selector:workflow:inputs:safe-return",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });
    const store = new AssetSelectorSessionStore();
    const returnService = new AssetSelectorReturnHandoffService();

    store.prepareSession({
      sessionKey,
      request,
      initialSelectedAssets: [{
        assetId: "asset:dataset:stable",
        assetType: "dataset",
      }],
    });
    store.activateSession(sessionKey);

    const stale = returnService.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:stale&inlineAssetType=dataset&returnContextId=workflow-studio%3Ademo%3Ainputs%3Asafe-return",
      sessionKey,
      request,
      sessionStore: store,
    });

    expect(stale.handled).toBeTrue();
    expect(stale.returnedAsset).toBeUndefined();
    expect(store.getSession(sessionKey)?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:stable"]);
    expect(store.getSession(sessionKey)?.validationErrors.length).toBeGreaterThan(0);

    store.transitionToCreatingNew(sessionKey, {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: sessionKey,
    });
    const malformed = returnService.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new-only-id&returnContextId=workflow-studio%3Ademo%3Ainputs%3Asafe-return",
      sessionKey,
      request,
      sessionStore: store,
    });

    expect(malformed.handled).toBeTrue();
    expect(malformed.returnedAsset).toBeUndefined();
    expect(store.getSession(sessionKey)?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:stable"]);
    expect(store.getSession(sessionKey)?.validationErrors[0]?.code).toBe("return-payload-invalid");
  });

  it("preserves canonical selector-linked references across save/load and rehydration", () => {
    const datasetRequest = createDatasetAssetSelectorRequest({
      requestId: "selector:workflow:persist-dataset",
      originatingStudio: "workflow-studio",
      originatingField: "inputs.dataset",
    });
    const agentRequest = createAgentAssistantAssetSelectorRequest({
      requestId: "selector:workflow:persist-agent",
      originatingStudio: "workflow-studio",
      originatingField: "steps.agent-assistant",
    });

    const draftWithRuntimeInput = Object.freeze({
      ...createEmptyWorkflowDraft(),
      inputs: Object.freeze([
        Object.freeze({
          id: "input-runtime",
          type: "runtime-input",
          sourceType: "runtime-parameter" as const,
          parameterKey: "runtime-key",
        }),
      ]),
    });

    let draft = replaceDatasetInputSelections(draftWithRuntimeInput, [{
      assetId: "asset:dataset:canonical",
      versionId: "asset:dataset:canonical:v1",
      name: "Canonical",
    }, {
      assetId: "asset:dataset:canonical",
      versionId: "asset:dataset:canonical:v1",
      name: "Duplicate",
    }, {
      assetId: "dataset:non-canonical",
      versionId: "dataset:non-canonical:v1",
      name: "Invalid",
    }]).draft;

    const addedStep = addWorkflowStep(draft);
    draft = setWorkflowStepAgentAssetSelection(addedStep.draft, addedStep.stepId, {
      assetId: "asset:agent:rehydrated",
      versionId: "asset:agent:rehydrated:v4",
      name: "Rehydrated Agent",
    }).draft;

    const serialized = serializeWorkflowDraft(draft);
    const restored = deserializeWorkflowDraft(serialized);

    expect(listDatasetInputs(restored).map((entry) => entry.asset.assetId)).toEqual(["asset:dataset:canonical"]);
    expect(restored.inputs.some((entry) => entry.id === "input-runtime")).toBeTrue();
    expect(restored.steps[0]?.assetRef?.asset.assetId).toBe("asset:agent:rehydrated");
    expect(restored.steps[0]?.assetRef?.asset.versionId).toBe("asset:agent:rehydrated:v4");

    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:rehydrate:inputs",
      request: datasetRequest,
      initialSelectedAssets: listDatasetInputs(restored).map((entry) => ({
        assetId: entry.asset.assetId,
        versionId: entry.asset.versionId,
        assetType: "dataset" as const,
        displayName: entry.title,
      })),
    });
    store.prepareSession({
      sessionKey: "workflow:rehydrate:steps",
      request: agentRequest,
      initialSelectedAssets: restored.steps.flatMap((step) => {
        const asset = step.assetRef?.asset;
        if (!asset) {
          return [];
        }
        return [{
          assetId: asset.assetId,
          versionId: asset.versionId,
          assetType: "agent" as const,
          displayName: step.title,
        }];
      }),
    });

    expect(store.getSession("workflow:rehydrate:inputs")?.selectedAssets).toHaveLength(1);
    expect(store.getSession("workflow:rehydrate:steps")?.selectedAssets).toHaveLength(1);
    expect(store.getSession("workflow:rehydrate:inputs")?.selectedAssets[0]?.assetId).toBe("asset:dataset:canonical");
    expect(store.getSession("workflow:rehydrate:steps")?.selectedAssets[0]?.assetId).toBe("asset:agent:rehydrated");
  });
});
