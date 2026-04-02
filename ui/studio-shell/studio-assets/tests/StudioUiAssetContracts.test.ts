import { describe, expect, it } from "bun:test";
import { StudioUiAssetKinds } from "../StudioAssetContracts";
import {
  defaultAtomicStudioUiPrimitiveContracts,
  StudioUiPrimitiveKinds,
} from "../StudioUiPrimitiveAssetContracts";
import {
  listStudioSurfaceAssetDefinitionsByKind,
  resolveStudioSurfaceAssetDefinitionById,
} from "../StudioSurfaceAssetDefinitions";
import {
  createDefaultStudioAssetRegistry,
  StudioAssetRegistrationCategories,
  StudioAssetRendererResolutionKinds,
} from "../StudioAssetRegistry";

describe("StudioUiAssetContracts", () => {
  it("defines atomic UI primitive contracts with leaf-only constraints", () => {
    expect(defaultAtomicStudioUiPrimitiveContracts.length).toBeGreaterThanOrEqual(5);
    for (const contract of defaultAtomicStudioUiPrimitiveContracts) {
      expect(contract.kind).toBe(StudioUiAssetKinds.atomic);
      expect(contract.constraints.allowsChildren).toBe(false);
      expect(contract.persistence.serialization).toBe("json");
      expect(contract.rendering.renderer).toBe("react");
      expect(contract.propsSchema.schemaVersion).toBe("1.0.0");
    }

    const viewer = defaultAtomicStudioUiPrimitiveContracts.find((entry) => entry.metadata?.tags?.includes(StudioUiPrimitiveKinds.viewer));
    expect(viewer?.capabilities.viewer).toBe(true);
    expect(viewer?.capabilities.interactive).toBe(false);
  });

  it("defines composed studio assets with explicit slot and composition rules", () => {
    const composed = listStudioSurfaceAssetDefinitionsByKind(StudioUiAssetKinds.composed);
    expect(composed.length).toBeGreaterThanOrEqual(2);
    for (const definition of composed) {
      expect(definition.contract.kind).toBe(StudioUiAssetKinds.composed);
      if (definition.contract.kind === StudioUiAssetKinds.composed) {
        expect(definition.contract.childSlots.length).toBeGreaterThan(0);
        expect(definition.contract.compositionRules.allowsNestedStudios).toBe(true);
        expect(definition.contract.persistence.serialization).toBe("json");
      }
    }
  });

  it("supports discovery by composed asset identity through shared definition list", () => {
    const resolved = resolveStudioSurfaceAssetDefinitionById("workflow-studio");
    expect(resolved).toBeDefined();
    expect(resolved?.contract.kind).toBe(StudioUiAssetKinds.composed);
  });

  it("defines system studio as a system-page contract with page structure and navigation settings", () => {
    const systemDefinition = resolveStudioSurfaceAssetDefinitionById("system-studio");
    expect(systemDefinition?.contract.kind).toBe(StudioUiAssetKinds.systemPage);
    if (systemDefinition?.contract.kind === StudioUiAssetKinds.systemPage) {
      expect(systemDefinition.contract.pageStructure.layoutKind).toBe("workspace");
      expect(systemDefinition.contract.pageStructure.regions.map((entry) => entry.regionId)).toEqual([
        "navigation",
        "workspace",
        "inspector",
      ]);
      expect(systemDefinition.contract.navigation?.route).toBe("/studio-shell/system");
      expect(systemDefinition.contract.layoutResponsibilities).toContain("compose-child-assets");
    }
  });

  it("registers and resolves atomic, composed, and system-page assets from the shared studio registry", () => {
    const registry = createDefaultStudioAssetRegistry();

    expect(registry.listByCategory(StudioAssetRegistrationCategories.atomicUi).length).toBeGreaterThanOrEqual(5);
    expect(registry.listByCategory(StudioAssetRegistrationCategories.composedUi).length).toBeGreaterThanOrEqual(2);
    expect(registry.listByCategory(StudioAssetRegistrationCategories.systemPage).map((entry) => entry.id)).toEqual([
      "system-studio",
    ]);

    const systemRegistration = registry.getById("system-studio");
    expect(systemRegistration?.kind).toBe(StudioUiAssetKinds.systemPage);
    expect(systemRegistration?.hooks.propsSchemaId).toBe("studio.system-surface.input");
    expect(systemRegistration?.renderer).toEqual({ renderer: "react", resolution: "definition-render" });
    expect(systemRegistration?.metadata).toMatchObject({
      id: "system-studio",
      assetType: "system-studio",
      group: "studio-surfaces",
      iconToken: "studio.system",
      contractCategory: "system-page",
    });
    expect(systemRegistration?.metadata.capabilityFlags).toContain("runtime");

    const resolvedDefinition = registry.resolveDefinitionById("workflow-studio");
    expect(resolvedDefinition?.contract.identity.studioId).toBe("workflow-studio");
  });

  it("resolves runtime renderers by asset id, kind, and category with graceful fallback for missing definitions", () => {
    const registry = createDefaultStudioAssetRegistry();

    const workflowRenderer = registry.resolveRendererById("workflow-studio");
    expect(workflowRenderer.kind).toBe(StudioAssetRendererResolutionKinds.resolved);
    expect(workflowRenderer.render).toBeDefined();

    const missingRenderer = registry.resolveRendererById("ui-primitive:text-input");
    expect(missingRenderer.kind).toBe(StudioAssetRendererResolutionKinds.missing);
    expect(missingRenderer.message).toContain("does not expose a runtime renderer definition");

    const composedRenderers = registry.resolveRenderersByKind(StudioUiAssetKinds.composed);
    expect(composedRenderers.length).toBeGreaterThanOrEqual(2);
    expect(composedRenderers.every((entry) => entry.kind === StudioAssetRendererResolutionKinds.resolved)).toBe(true);

    const systemCategoryRenderers = registry.resolveRenderersByCategory(StudioAssetRegistrationCategories.systemPage);
    expect(systemCategoryRenderers.map((entry) => entry.assetId)).toEqual(["system-studio"]);
    expect(systemCategoryRenderers[0]?.kind).toBe(StudioAssetRendererResolutionKinds.resolved);
  });
});
