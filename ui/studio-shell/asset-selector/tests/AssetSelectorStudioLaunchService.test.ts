import { describe, expect, it } from "bun:test";
import {
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
} from "../../../../domain/studio-shell/AssetSelectorContract";
import { AssetSelectorStudioLaunchService } from "../AssetSelectorStudioLaunchService";

function createSelectorRequest(assetType: "dataset" | "agent") {
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
      usageContext: assetType === "dataset" ? "workflow-input" : "workflow-step",
      launchSource: "wizard",
    },
  });
}

describe("AssetSelectorStudioLaunchService", () => {
  it("launches dataset studio with selector context and return target", () => {
    const service = new AssetSelectorStudioLaunchService();
    const result = service.launch({
      sessionKey: "selector:workflow:inputs",
      selectorRequest: createSelectorRequest("dataset"),
      routePath: "/studio-shell/workflow/wizard",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-inputs",
    });

    expect(result?.launchPath.startsWith("/studio-shell/dataset?")).toBeTrue();
    const query = new URLSearchParams(result?.launchPath.split("?")[1]?.split("#")[0] ?? "");
    expect(query.get("entryMode")).toBe("new");
    expect(query.get("returnContextId")).toBe("selector:workflow:inputs");
    expect(query.get("selectorSessionId")).toBe("selector:workflow:inputs");
    expect(query.get("selectorAssetType")).toBe("dataset");
    expect(query.get("returnTo")).toBe("/studio-shell/workflow/wizard?mode=wizard#workflow-wizard-inputs");
  });

  it("launches agent studio for agent selectors", () => {
    const service = new AssetSelectorStudioLaunchService();
    const result = service.launch({
      sessionKey: "selector:workflow:steps",
      selectorRequest: createSelectorRequest("agent"),
      routePath: "/studio-shell/workflow/wizard",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-steps",
    });

    expect(result?.launchPath.startsWith("/agent-studio?")).toBeTrue();
    const query = new URLSearchParams(result?.launchPath.split("?")[1] ?? "");
    expect(query.get("selectorSessionId")).toBe("selector:workflow:steps");
    expect(query.get("selectorAssetType")).toBe("agent");
  });
});

