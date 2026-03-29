import { describe, expect, it } from "bun:test";
import {
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
} from "../../../../domain/studio-shell/AssetSelectorContract";
import { AssetSelectorSessionStore } from "../../../../application/studio-entry/AssetSelectorSessionStore";
import {
  AssetSelectorUsageContexts,
} from "../../../../application/studio-entry/AssetSelectorCapabilityRegistry";
import { InlineAssetCreationService, InlineAssetReturnStatuses } from "../../../routes/InlineAssetCreation";
import { createStudioLaunchHandoffContract, serializeStudioLaunchHandoffContract } from "../../../routes/StudioHandoffContract";
import { AssetSelectorReturnHandoffService } from "../AssetSelectorReturnHandoffService";

function createRequest(assetType: "dataset" | "agent", usageContext: string) {
  return createAssetSelectorRequest({
    requestId: `selector:${assetType}`,
    assetType,
    selectionMode: AssetSelectorSelectionModes.singleSelect,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
    constraints: {
      minSelections: 0,
      maxSelections: 1,
      required: false,
    },
    context: {
      originatingStudio: "workflow-studio",
      originatingField: assetType === "dataset" ? "inputs.dataset" : "steps.agent-assistant",
      usageContext,
      launchSource: "wizard",
    },
  });
}

describe("AssetSelectorReturnHandoffService", () => {
  it("returns created assets to the matching selector session and reactivates selector state", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
    });
    store.activateSession("selector:inputs");
    store.transitionToCreatingNew("selector:inputs", {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: "selector:inputs",
      launchHandoffId: "handoff:return:created",
    });

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new&inlineAssetType=dataset&inlineDisplayName=New%20dataset&returnContextId=selector:inputs&inlineHandoffId=handoff:return:created",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.returnedAsset?.assetId).toBe("asset:dataset:new");
    expect(outcome.returnedAsset?.displayName).toBe("New dataset");
    expect(store.getSession("selector:inputs")?.lifecycleState).toBe("active");
    expect(store.getSession("selector:inputs")?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:new"]);
    expect(outcome.nextSearch).toBe("");
  });

  it("rejects malformed created return payloads", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
    });
    store.activateSession("selector:inputs");
    store.transitionToCreatingNew("selector:inputs", {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: "selector:inputs",
      launchHandoffId: "handoff:return:malformed",
    });

    const service = new AssetSelectorReturnHandoffService();
    service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new&returnContextId=selector:inputs&inlineHandoffId=handoff:return:malformed",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    const state = store.getSession("selector:inputs");
    expect(state?.validationErrors.length).toBeGreaterThan(0);
    expect(state?.validationErrors[0]?.code).toBe("return-payload-invalid");
  });

  it("rejects mismatched return asset types through selector validation", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
    });
    store.activateSession("selector:inputs");
    store.transitionToCreatingNew("selector:inputs", {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: "selector:inputs",
      launchHandoffId: "handoff:return:mismatched-type",
    });

    const service = new AssetSelectorReturnHandoffService();
    service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:agent:new&inlineAssetType=agent&returnContextId=selector:inputs&inlineHandoffId=handoff:return:mismatched-type",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    const state = store.getSession("selector:inputs");
    expect(state?.validationErrors.length).toBeGreaterThan(0);
    expect(state?.lifecycleState).toBe("active");
  });

  it("rejects stale created-return payloads when session is not in creating-new lifecycle", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
    });
    store.activateSession("selector:inputs");

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new&inlineAssetType=dataset&returnContextId=selector:inputs",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.returnedAsset).toBeUndefined();
    expect(store.getSession("selector:inputs")?.validationErrors.length).toBeGreaterThan(0);
  });

  it("does not consume returns for other selector sessions", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
    });
    store.prepareSession({
      sessionKey: "selector:steps",
      request,
    });
    store.activateSession("selector:inputs");
    store.activateSession("selector:steps");

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new&inlineAssetType=dataset&returnContextId=selector:steps",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeFalse();
    expect(store.getSession("selector:inputs")?.selectedAssets).toHaveLength(0);
    expect(store.getSession("selector:steps")?.selectedAssets).toHaveLength(0);
  });

  it("handles no-selection returns without mutating selected assets", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
      initialSelectedAssets: [{
        assetId: "asset:dataset:existing",
        assetType: "dataset",
      }],
    });
    store.activateSession("selector:inputs");
    store.transitionToCreatingNew("selector:inputs", {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: "selector:inputs",
      launchHandoffId: "handoff:return:no-selection",
    });

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=no-selection&returnContextId=selector:inputs&inlineHandoffId=handoff:return:no-selection",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.returnedAsset).toBeUndefined();
    expect(store.getSession("selector:inputs")?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:existing"]);
    expect(store.getSession("selector:inputs")?.lifecycleState).toBe("active");
  });

  it("rejects returns that do not match expected selector-target metadata", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
      initialSelectedAssets: [{
        assetId: "asset:dataset:existing",
        assetType: "dataset",
      }],
    });
    store.activateSession("selector:inputs");
    store.transitionToCreatingNew("selector:inputs", {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: "selector:inputs",
      launchHandoffId: "handoff:return:wrong-target",
    });

    const inlineCreationService = new InlineAssetCreationService();
    const handoff = createStudioLaunchHandoffContract({
      handoffId: "handoff:return:wrong-target",
      launchSource: "workflow-studio",
      origin: {
        studioType: "workflow-studio",
        route: {
          path: "/studio-shell/workflow/wizard/inputs",
        },
      },
      target: {
        selectorSessionId: "selector:inputs",
        assetType: "dataset",
        originatingField: "inputs.dataset",
        usageContext: "workflow-input",
        selectorTargetId: "workflow-inputs:other",
      },
      returnTarget: {
        routePath: "/studio-shell/workflow/wizard/inputs",
        contextId: "selector:inputs",
      },
    });
    const returnPath = inlineCreationService.buildReturnPath({
      returnTarget: {
        routePath: `/studio-shell/workflow/wizard/inputs?studioHandoff=${serializeStudioLaunchHandoffContract(handoff)}`,
        contextId: "selector:inputs",
      },
      payload: {
        status: InlineAssetReturnStatuses.created,
        assetId: "asset:dataset:new",
        assetType: "dataset",
      },
    });

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: `?${returnPath.split("?")[1]?.split("#")[0] ?? ""}`,
      sessionKey: "selector:inputs",
      request,
      expectedSelectorTargetId: "workflow-inputs:dataset",
      expectedOriginatingField: "inputs.dataset",
      expectedUsageContext: "workflow-input",
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.returnedAsset).toBeUndefined();
    expect(outcome.nextSearch).toBe("");
    expect(store.getSession("selector:inputs")?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:existing"]);
    expect(store.getSession("selector:inputs")?.validationErrors.length).toBeGreaterThan(0);
  });

  it("ignores created returns with stale handoff ids so repeated launches do not collide", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("dataset", AssetSelectorUsageContexts.workflowInput);
    store.prepareSession({
      sessionKey: "selector:inputs",
      request,
      initialSelectedAssets: [{
        assetId: "asset:dataset:existing",
        assetType: "dataset",
      }],
    });
    store.activateSession("selector:inputs");
    store.transitionToCreatingNew("selector:inputs", {
      originatingContext: request.context,
      requestedAssetType: "dataset",
      returnTargetSessionKey: "selector:inputs",
      launchHandoffId: "handoff:return:latest",
    });

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:stale&inlineAssetType=dataset&returnContextId=selector:inputs&inlineHandoffId=handoff:return:stale",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.returnedAsset).toBeUndefined();
    expect(store.getSession("selector:inputs")?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:existing"]);
    expect(store.getSession("selector:inputs")?.validationErrors[0]?.code).toBe("return-payload-invalid");
  });

  it("treats abandoned returns as non-destructive no-op outcomes", () => {
    const store = new AssetSelectorSessionStore();
    const request = createRequest("agent", AssetSelectorUsageContexts.workflowStep);
    store.prepareSession({
      sessionKey: "selector:steps",
      request,
      initialSelectedAssets: [{
        assetId: "asset:agent:existing",
        assetType: "agent",
      }],
    });
    store.activateSession("selector:steps");
    store.transitionToCreatingNew("selector:steps", {
      originatingContext: request.context,
      requestedAssetType: "agent",
      returnTargetSessionKey: "selector:steps",
      launchHandoffId: "handoff:return:abandoned",
    });

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=abandoned&returnContextId=selector:steps&inlineHandoffId=handoff:return:abandoned",
      sessionKey: "selector:steps",
      request,
      sessionStore: store,
    });

    expect(outcome.handled).toBeTrue();
    expect(outcome.outcomeKind).toBe("abandoned");
    expect(outcome.returnedAsset).toBeUndefined();
    expect(store.getSession("selector:steps")?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:agent:existing"]);
    expect(store.getSession("selector:steps")?.lifecycleState).toBe("active");
  });
});
