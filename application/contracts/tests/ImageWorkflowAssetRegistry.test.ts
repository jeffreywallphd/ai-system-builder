import { describe, expect, it } from "bun:test";
import { ImageWorkflowAssetIntentTypes } from "../ImageWorkflowAssetContract";
import { createDefaultImageWorkflowAssetRegistry, listCoreImageWorkflowIntentTypes } from "../ImageWorkflowAssetRegistry";

describe("ImageWorkflowAssetRegistry", () => {
  it("registers all high-level image workflow assets as workflow taxonomy entries", () => {
    const registry = createDefaultImageWorkflowAssetRegistry();
    const entries = registry.list();

    expect(entries.map((entry) => entry.intentType).sort()).toEqual([...listCoreImageWorkflowIntentTypes()].sort());
    for (const entry of entries) {
      expect(entry.taxonomy.structuralKind).toBe("composite");
      expect(entry.taxonomy.semanticRole).toBe("workflow");
      expect(entry.taxonomy.behaviorKind).toBe("deterministic");
      expect(entry.preview.intentType).toBe(entry.intentType);
    }
  });

  it("exposes consistent metadata for discovery, inspection, and configuration surfaces", () => {
    const registry = createDefaultImageWorkflowAssetRegistry();
    const restyle = registry.listByIntentTypes([ImageWorkflowAssetIntentTypes.restyle])[0];

    expect(restyle?.id).toBe("image-workflow.restyle");
    expect(restyle?.contract.identity.assetType).toBe("image-workflow");
    expect(restyle?.preview.compositionSummary.adapterBoundary.adapterId).toBe("image-workflow-execution-adapter");
    expect(restyle?.configurationSurface.some((entry) => entry.id === "styleStrength")).toBeTrue();
    expect(restyle?.configurationSurface.some((entry) => entry.id.includes("comfy"))).toBeFalse();
    expect(restyle?.contract.input.fields.some((field) => field.id.includes("node"))).toBeFalse();
    expect(Array.isArray(restyle?.inputBindings.bindings)).toBeTrue();
    expect(Array.isArray(restyle?.outputBindings.bindings)).toBeTrue();
    expect(Array.isArray(restyle?.uiTriggerBindings.bindings)).toBeTrue();
    expect(restyle?.outputBindings.bindings.some((binding: { targetType: string }) => binding.targetType === "history-dataset")).toBeTrue();
    expect(restyle?.uiTriggerBindings.bindings.some((binding: { event: { kind: string } }) => binding.event.kind === "submit")).toBeTrue();
  });

  it("keeps composition and inspectability boundaries portable across the full 3.1 asset set", () => {
    const registry = createDefaultImageWorkflowAssetRegistry();

    for (const asset of registry.listDefinitions()) {
      expect(asset.composition.adapterBoundary.adapterId).toBe("image-workflow-execution-adapter");
      expect(asset.contract.intendedUse.toLowerCase()).not.toContain("comfyui");
      expect(asset.contract.config.fields.some((field) => field.id.toLowerCase().includes("node"))).toBeFalse();
      expect(asset.preview.inspectableStageIds.length).toBeGreaterThan(0);
      expect(asset.preview.outputSummary.length).toBeGreaterThan(0);
    }

    const batchTransform = registry.getByIntent(ImageWorkflowAssetIntentTypes.batchTransform);
    expect(batchTransform?.contract.input.fields.some((field) => field.id === "batchItems")).toBeTrue();
    expect(batchTransform?.contract.output.fields.some((field) => field.id === "batchSummary")).toBeTrue();
  });
});
