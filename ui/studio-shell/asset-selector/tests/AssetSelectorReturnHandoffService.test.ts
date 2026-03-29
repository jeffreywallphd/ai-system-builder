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
    });

    const service = new AssetSelectorReturnHandoffService();
    const outcome = service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new&inlineAssetType=dataset&inlineDisplayName=New%20dataset&returnContextId=selector:inputs",
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

    const service = new AssetSelectorReturnHandoffService();
    service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:dataset:new&returnContextId=selector:inputs",
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

    const service = new AssetSelectorReturnHandoffService();
    service.handle({
      search: "?inlineReturn=1&inlineStatus=created&inlineAssetId=asset:agent:new&inlineAssetType=agent&returnContextId=selector:inputs",
      sessionKey: "selector:inputs",
      request,
      sessionStore: store,
    });

    const state = store.getSession("selector:inputs");
    expect(state?.validationErrors.length).toBeGreaterThan(0);
    expect(state?.lifecycleState).toBe("active");
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
});
