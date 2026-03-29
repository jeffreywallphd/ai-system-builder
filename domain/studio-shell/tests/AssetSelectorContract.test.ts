import { describe, expect, it } from "bun:test";
import {
  AssetSelectorResultKinds,
  AssetSelectorSelectionModes,
  AssetSelectorSelectionTypes,
  AssetSelectorValidationIssueCodes,
  createAssetSelectorRequest,
  createAssetSelectorResult,
  validateAssetSelectorResult,
} from "../AssetSelectorContract";

describe("AssetSelectorContract", () => {
  it("supports valid single-select existing-asset flow", () => {
    const request = createAssetSelectorRequest({
      requestId: "selector:workflow-input:dataset",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { required: true, minSelections: 1, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs.dataset",
        usageContext: "workflow-input",
      },
    });

    const result = createAssetSelectorResult({
      request,
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: [{
          assetId: "asset:dataset:customers",
          versionId: "asset:dataset:customers:v1",
          assetType: "dataset",
          displayName: "Customers Dataset",
        }],
      },
    });

    expect(result.kind).toBe(AssetSelectorResultKinds.selected);
    if (result.kind === AssetSelectorResultKinds.selected) {
      expect(result.assets).toHaveLength(1);
      expect(result.assets[0]?.assetType).toBe("dataset");
    }
  });

  it("supports valid multi-select create-new flow", () => {
    const request = createAssetSelectorRequest({
      requestId: "selector:workflow-step:agent",
      assetType: "agent",
      selectionMode: AssetSelectorSelectionModes.multiSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset, AssetSelectorSelectionTypes.createNewAsset],
      constraints: { minSelections: 1, maxSelections: 3 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "steps[].assistant",
        usageContext: "workflow-step",
      },
    });

    const validation = validateAssetSelectorResult({
      request,
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.createNewAsset,
        assets: [{
          assetId: "asset:agent:reviewer",
          versionId: "asset:agent:reviewer:v1",
          assetType: "agent",
          displayName: "Reviewer Assistant",
        }],
      },
    });

    expect(validation.valid).toBeTrue();
  });

  it("supports explicit cancel behavior", () => {
    const request = createAssetSelectorRequest({
      requestId: "selector:workflow-input:cancel",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { required: false, minSelections: 0, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs.dataset",
      },
    });

    const validation = validateAssetSelectorResult({
      request,
      result: {
        kind: AssetSelectorResultKinds.cancelled,
        reason: "user-closed-selector",
      },
    });

    expect(validation.valid).toBeTrue();
    expect(validation.issues).toEqual([]);
  });

  it("rejects invalid asset types in request normalization", () => {
    expect(() => createAssetSelectorRequest({
      requestId: "selector:invalid-type",
      assetType: "invalid-asset-type" as "dataset",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { minSelections: 1, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs.asset",
      },
    })).toThrow("is not supported");
  });

  it("rejects selection-limit violations and malformed return payloads", () => {
    const request = createAssetSelectorRequest({
      requestId: "selector:malformed",
      assetType: "dataset",
      selectionMode: AssetSelectorSelectionModes.singleSelect,
      allowedSelectionTypes: [AssetSelectorSelectionTypes.existingAsset],
      constraints: { minSelections: 1, maxSelections: 1 },
      context: {
        originatingStudio: "workflow-studio",
        originatingField: "inputs.dataset",
      },
    });

    const validation = validateAssetSelectorResult({
      request,
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: [{
          assetId: "asset:dataset:one",
          assetType: "dataset",
        }, {
          assetId: "asset:dataset:two",
          assetType: "dataset",
        }],
      },
    });

    expect(validation.valid).toBeFalse();
    expect(validation.issues.some((issue) => issue.code === AssetSelectorValidationIssueCodes.selectionLimitViolation)).toBeTrue();

    const malformed = validateAssetSelectorResult({
      request,
      result: {
        kind: AssetSelectorResultKinds.selected,
        selectionType: AssetSelectorSelectionTypes.existingAsset,
        assets: [{
          assetId: " ",
          assetType: "dataset",
        }],
      },
    });
    expect(malformed.valid).toBeFalse();
    expect(malformed.issues.some((issue) => issue.code === AssetSelectorValidationIssueCodes.malformedReturnPayload)).toBeTrue();
  });
});
