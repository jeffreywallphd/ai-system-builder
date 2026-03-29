import { describe, expect, it } from "bun:test";
import { createEmptyWorkflowDraft, deserializeWorkflowDraft, serializeWorkflowDraft } from "../../../../domain/workflow-studio/WorkflowStudioDomain";
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
import { addWorkflowStep, setWorkflowStepAgentAssetSelection } from "../../workflow/WorkflowWizardSteps";

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
