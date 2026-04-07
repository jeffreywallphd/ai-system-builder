import { describe, expect, it } from "bun:test";
import {
  AssetSelectorApplicationValidationService,
  AssetSelectorCapabilityRegistry,
  AssetSelectorUsageContexts,
  createDefaultAssetSelectorCapabilityRegistry,
} from "../AssetSelectorCapabilityRegistry";
import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  AssetSelectorValidationIssueCodes,
  createAssetSelectorRequest,
} from "../../../domain/studio-shell/AssetSelectorContract";

describe("AssetSelectorCapabilityRegistry", () => {
  it("supports default workflow input/step mappings", () => {
    const registry = createDefaultAssetSelectorCapabilityRegistry();
    expect(registry.isAssetTypeAllowed(AssetSelectorUsageContexts.workflowInput, "dataset")).toBeTrue();
    expect(registry.isAssetTypeAllowed(AssetSelectorUsageContexts.workflowStep, "agent")).toBeTrue();
    expect(registry.isAssetTypeAllowed(AssetSelectorUsageContexts.workflowImageTransform, "workflow")).toBeTrue();
  });

  it("rejects invalid combinations through application-layer validation", () => {
    const service = new AssetSelectorApplicationValidationService(createDefaultAssetSelectorCapabilityRegistry());
    const request = createAssetSelectorRequest({
      requestId: "selector:invalid-combo",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { minSelections: 1, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "steps[].assistant",
        usageContext: AssetSelectorUsageContexts.workflowStep,
      },
    });

    const validation = service.validateRequest(request);
    expect(validation.valid).toBeFalse();
    expect(validation.issues.some((issue) => issue.code === AssetSelectorValidationIssueCodes.invalidAssetType)).toBeTrue();
  });

  it("enforces matrix rules for selector results with defensive fail-fast checks", () => {
    const service = new AssetSelectorApplicationValidationService(createDefaultAssetSelectorCapabilityRegistry());
    const request = createAssetSelectorRequest({
      requestId: "selector:workflow-step:agent",
      assetType: "agent",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { minSelections: 1, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "steps[].assistant",
        usageContext: AssetSelectorUsageContexts.workflowStep,
      },
    });

    const validation = service.validateResult({
      request,
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: [{
          assetId: "asset:dataset:customers",
          assetType: "dataset",
        }],
      },
    });

    expect(validation.valid).toBeFalse();
    expect(validation.issues.some((issue) => issue.code === AssetSelectorValidationIssueCodes.returnAssetTypeMismatch)).toBeTrue();
  });

  it("supports extensibility by registering new usage-context mappings without refactoring", () => {
    const registry = new AssetSelectorCapabilityRegistry();
    registry.register({
      usageContext: "workflow-training",
      allowedAssetTypes: ["training-recipe"],
      metadata: {
        scope: "future",
      },
    });

    const service = new AssetSelectorApplicationValidationService(registry);
    const request = createAssetSelectorRequest({
      requestId: "selector:workflow-training",
      assetType: "training-recipe",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { minSelections: 1, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "training.recipe",
        usageContext: "workflow-training",
      },
    });

    const validation = service.validateRequest(request);
    expect(validation.valid).toBeTrue();
    expect(registry.isAssetTypeAllowed("workflow-training", "training-recipe")).toBeTrue();
  });
});
