import { describe, expect, it } from "bun:test";
import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
} from "../../../domain/studio-shell/AssetSelectorContract";
import { AssetSelectorUsageContexts } from "../AssetSelectorCapabilityRegistry";
import {
  AssetSelectorSessionLifecycleStates,
  AssetSelectorSessionStore,
} from "../AssetSelectorSessionStore";

function createWorkflowInputRequest() {
  return createAssetSelectorRequest({
    requestId: "selector:workflow-input:dataset",
    assetType: "dataset",
    selectionMode: AssetSelectorSelectionModes.multiSelect,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
    constraints: {
      minSelections: 0,
      maxSelections: 5,
    },
    context: {
      originatingStudio: "workflow-studio",
      originatingField: "inputs",
      usageContext: AssetSelectorUsageContexts.workflowInput,
      launchSource: "wizard",
    },
  });
}

function createSingleSelectWorkflowInputRequest() {
  return createAssetSelectorRequest({
    requestId: "selector:workflow-input:dataset:single",
    assetType: "dataset",
    selectionMode: AssetSelectorSelectionModes.singleSelect,
    allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
    constraints: {
      required: true,
      minSelections: 1,
      maxSelections: 1,
    },
    context: {
      originatingStudio: "workflow-studio",
      originatingField: "inputs.primary",
      usageContext: AssetSelectorUsageContexts.workflowInput,
      launchSource: "wizard",
    },
  });
}

describe("AssetSelectorSessionStore", () => {
  it("supports lifecycle transitions idle -> active -> creating-new -> returning -> completed", () => {
    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:inputs",
      request: createWorkflowInputRequest(),
    });
    store.activateSession("workflow:inputs");
    store.transitionToCreatingNew("workflow:inputs");
    store.handleReturnPayload({
      sessionKey: "workflow:inputs",
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.createNewAsset,
        assets: [{
          assetId: "asset:dataset:new-one",
          assetType: "dataset",
          versionId: "asset:dataset:new-one:v1",
        }],
      },
    });

    const state = store.getSession("workflow:inputs");
    expect(state?.lifecycleState).toBe(AssetSelectorSessionLifecycleStates.completed);
    expect(state?.lifecycleHistory).toEqual([
      AssetSelectorSessionLifecycleStates.idle,
      AssetSelectorSessionLifecycleStates.active,
      AssetSelectorSessionLifecycleStates.creatingNew,
      AssetSelectorSessionLifecycleStates.returning,
      AssetSelectorSessionLifecycleStates.completed,
    ]);
  });

  it("preserves state across navigation snapshots and restoration", () => {
    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:inputs",
      request: createWorkflowInputRequest(),
    });
    store.activateSession("workflow:inputs");
    store.togglePendingSelection("workflow:inputs", {
      assetId: "asset:dataset:customers",
      assetType: "dataset",
      versionId: "asset:dataset:customers:v1",
    });
    store.confirmPendingSelections("workflow:inputs");

    const snapshot = store.createNavigationSnapshot("workflow:inputs");
    const restoredStore = new AssetSelectorSessionStore();
    const restored = restoredStore.restoreFromSnapshot(snapshot);

    expect(restored.restored).toBeTrue();
    const restoredState = restoredStore.getSession("workflow:inputs");
    expect(restoredState?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:customers"]);
    expect(restoredState?.lifecycleState).toBe(AssetSelectorSessionLifecycleStates.completed);
  });

  it("keeps multiple selector sessions isolated", () => {
    const store = new AssetSelectorSessionStore();
    const request = createWorkflowInputRequest();
    store.prepareSession({ sessionKey: "workflow:inputs", request });
    store.prepareSession({ sessionKey: "workflow:steps", request });
    store.activateSession("workflow:inputs");
    store.activateSession("workflow:steps");

    store.togglePendingSelection("workflow:inputs", {
      assetId: "asset:dataset:inputs",
      assetType: "dataset",
    });
    store.confirmPendingSelections("workflow:inputs");

    store.togglePendingSelection("workflow:steps", {
      assetId: "asset:dataset:steps",
      assetType: "dataset",
    });

    expect(store.getSession("workflow:inputs")?.selectedAssets.map((entry) => entry.assetId)).toEqual(["asset:dataset:inputs"]);
    expect(store.getSession("workflow:steps")?.selectedAssets).toHaveLength(0);
    expect(store.getSession("workflow:steps")?.pendingSelections.map((entry) => entry.assetId)).toEqual(["asset:dataset:steps"]);
  });

  it("merges return payload assets into existing state for multi-select sessions", () => {
    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:inputs",
      request: createWorkflowInputRequest(),
      initialSelectedAssets: [{
        assetId: "asset:dataset:customers",
        assetType: "dataset",
      }],
    });
    store.activateSession("workflow:inputs");

    store.handleReturnPayload({
      sessionKey: "workflow:inputs",
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: [{
          assetId: "asset:dataset:orders",
          assetType: "dataset",
        }],
      },
    });

    expect(store.getSession("workflow:inputs")?.selectedAssets.map((entry) => entry.assetId)).toEqual([
      "asset:dataset:customers",
      "asset:dataset:orders",
    ]);
  });

  it("enforces single-select pending selection behavior", () => {
    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:inputs:single",
      request: createSingleSelectWorkflowInputRequest(),
    });
    store.activateSession("workflow:inputs:single");

    store.togglePendingSelection("workflow:inputs:single", {
      assetId: "asset:dataset:one",
      assetType: "dataset",
    });
    store.togglePendingSelection("workflow:inputs:single", {
      assetId: "asset:dataset:two",
      assetType: "dataset",
    });

    expect(store.getSession("workflow:inputs:single")?.pendingSelections.map((entry) => entry.assetId)).toEqual([
      "asset:dataset:two",
    ]);
  });

  it("rejects return payloads with invalid asset types", () => {
    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:inputs",
      request: createWorkflowInputRequest(),
    });
    store.activateSession("workflow:inputs");

    store.handleReturnPayload({
      sessionKey: "workflow:inputs",
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: [{
          assetId: "asset:agent:reviewer",
          assetType: "agent",
        }],
      },
    });

    const state = store.getSession("workflow:inputs");
    expect(state?.lifecycleState).toBe(AssetSelectorSessionLifecycleStates.active);
    expect(state?.validationErrors.length).toBeGreaterThan(0);
  });

  it("reports restoration failures for malformed snapshots", () => {
    const store = new AssetSelectorSessionStore();
    const restored = store.restoreFromSnapshot({
      sessionKey: "workflow:inputs",
      request: {
        ...(createWorkflowInputRequest()),
        assetType: "invalid" as "dataset",
      },
      lifecycleState: AssetSelectorSessionLifecycleStates.active,
      selectedAssets: [],
      pendingSelections: [],
    });

    expect(restored.restored).toBeFalse();
    expect(restored.error?.code).toBe("restoration-failed");
  });

  it("supports explicit confirm and cancel session actions", () => {
    const store = new AssetSelectorSessionStore();
    store.prepareSession({
      sessionKey: "workflow:inputs:actions",
      request: createWorkflowInputRequest(),
    });
    store.activateSession("workflow:inputs:actions");
    store.togglePendingSelection("workflow:inputs:actions", {
      assetId: "asset:dataset:customers",
      assetType: "dataset",
    });
    store.confirmPendingSelections("workflow:inputs:actions");
    expect(store.getSession("workflow:inputs:actions")?.lifecycleState).toBe(AssetSelectorSessionLifecycleStates.completed);

    store.cancelSession("workflow:inputs:actions", "user-cancelled");
    expect(store.getSession("workflow:inputs:actions")?.lifecycleState).toBe(AssetSelectorSessionLifecycleStates.cancelled);
  });
});
