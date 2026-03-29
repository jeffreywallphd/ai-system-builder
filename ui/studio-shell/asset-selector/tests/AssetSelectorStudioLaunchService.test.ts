import { describe, expect, it } from "bun:test";
import {
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  createAssetSelectorRequest,
} from "../../../../domain/studio-shell/AssetSelectorContract";
import { AssetSelectorStudioLaunchService } from "../AssetSelectorStudioLaunchService";
import { InlineAssetCreationService } from "../../../routes/InlineAssetCreation";

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
    const inlineCreationService = new InlineAssetCreationService();
    const result = service.launch({
      sessionKey: "selector:workflow:inputs",
      selectorRequest: createSelectorRequest("dataset"),
      routePath: "/studio-shell/workflow/wizard",
      routeSearch: "?mode=wizard",
      routeHash: "#workflow-wizard-inputs",
      selectorTargetId: "workflow-inputs:dataset",
      workflowOrigin: {
        studioId: "studio-workflows",
        modeId: "wizard",
        wizardPageId: "inputs",
        draftReference: {
          studioId: "studio-workflows",
          draftId: "draft-workflow-1",
          sessionId: "session-workflow-1",
        },
        draftState: "{\"inputs\":[]}",
      },
    });

    expect(result?.launchPath.startsWith("/studio-shell/dataset?")).toBeTrue();
    const query = new URLSearchParams(result?.launchPath.split("?")[1]?.split("#")[0] ?? "");
    expect(query.get("entryMode")).toBe("new");
    expect(query.get("returnContextId")).toBe("selector:workflow:inputs");
    expect(query.get("selectorSessionId")).toBe("selector:workflow:inputs");
    expect(query.get("selectorAssetType")).toBe("dataset");
    expect(query.get("returnTo")).toBe("/studio-shell/workflow/wizard?mode=wizard#workflow-wizard-inputs");
    const parsedHandoff = inlineCreationService.parseStudioHandoffFromSearch(`?${query.toString()}`);
    expect(parsedHandoff?.origin.route.path).toBe("/studio-shell/workflow/wizard");
    expect(parsedHandoff?.origin.workflowAuthoring?.draftReference?.draftId).toBe("draft-workflow-1");
    expect(parsedHandoff?.target.selector.selectorTargetId).toBe("workflow-inputs:dataset");
    expect(parsedHandoff?.returnContract.target.routePath).toBe("/studio-shell/workflow/wizard?mode=wizard#workflow-wizard-inputs");
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

  it("creates unique handoff ids across repeated launches for the same selector session", () => {
    const service = new AssetSelectorStudioLaunchService();
    const inlineCreationService = new InlineAssetCreationService();

    const first = service.launch({
      sessionKey: "selector:workflow:inputs",
      selectorRequest: createSelectorRequest("dataset"),
      routePath: "/studio-shell/workflow/wizard",
      routeSearch: "?mode=wizard",
    });
    const second = service.launch({
      sessionKey: "selector:workflow:inputs",
      selectorRequest: createSelectorRequest("dataset"),
      routePath: "/studio-shell/workflow/wizard",
      routeSearch: "?mode=wizard",
    });

    const firstQuery = new URLSearchParams(first?.launchPath.split("?")[1]?.split("#")[0] ?? "");
    const secondQuery = new URLSearchParams(second?.launchPath.split("?")[1]?.split("#")[0] ?? "");
    const firstHandoff = inlineCreationService.parseStudioHandoffFromSearch(`?${firstQuery.toString()}`);
    const secondHandoff = inlineCreationService.parseStudioHandoffFromSearch(`?${secondQuery.toString()}`);

    expect(firstHandoff?.launch.handoffId).toBeDefined();
    expect(secondHandoff?.launch.handoffId).toBeDefined();
    expect(firstHandoff?.launch.handoffId).not.toBe(secondHandoff?.launch.handoffId);
  });
});

