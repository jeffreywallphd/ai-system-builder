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
import { StudioAssetCompositionValidationIssueCodes } from "../StudioAssetComposition";

describe("StudioUiAssetContracts", () => {
  it("defines atomic UI primitive contracts with leaf-only constraints", () => {
    expect(defaultAtomicStudioUiPrimitiveContracts.length).toBeGreaterThanOrEqual(5);
    for (const contract of defaultAtomicStudioUiPrimitiveContracts) {
      expect(contract.kind).toBe(StudioUiAssetKinds.atomic);
      expect(contract.contractVersion).toBe("1.0.0");
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
        expect(definition.contract.contractVersion).toBe("1.0.0");
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
    expect(systemRegistration?.contractVersion).toBe("1.0.0");
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

  it("exposes panel layout and header fields through composed panel property schema", () => {
    const registry = createDefaultStudioAssetRegistry();
    const panel = registry.getById("ui-composed:panel");
    expect(panel?.contract.kind).toBe(StudioUiAssetKinds.composed);
    if (panel?.contract.kind !== StudioUiAssetKinds.composed) {
      return;
    }

    const fields = panel.contract.propsSchema.propertySchema?.sections.flatMap((section) => section.fields) ?? [];
    expect(fields.some((field) => field.path === "layout.mode")).toBeTrue();
    expect(fields.some((field) => field.path === "layout.columns")).toBeTrue();
    expect(fields.some((field) => field.path === "header.visible")).toBeTrue();
    expect(fields.some((field) => field.path === "header.subtitle")).toBeTrue();
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
    expect(composedRenderers.some((entry) => entry.kind === StudioAssetRendererResolutionKinds.resolved)).toBeTrue();
    expect(composedRenderers.some((entry) => entry.kind === StudioAssetRendererResolutionKinds.invalid)).toBeFalse();

    const systemCategoryRenderers = registry.resolveRenderersByCategory(StudioAssetRegistrationCategories.systemPage);
    expect(systemCategoryRenderers.map((entry) => entry.assetId)).toEqual(["system-studio"]);
    expect(systemCategoryRenderers[0]?.kind).toBe(StudioAssetRendererResolutionKinds.resolved);
  });

  it("validates slot and region compatibility with cardinality and nesting rules", () => {
    const registry = createDefaultStudioAssetRegistry();
    const invalid = registry.validateCompositionTree({
      nodeId: "root-workflow",
      assetId: "workflow-studio",
      slots: [
        {
          placementId: "main",
          children: [
            {
              nodeId: "system-child",
              assetId: "system-studio",
            },
            {
              nodeId: "viewer-child",
              assetId: "ui-primitive:viewer",
              slots: [
                {
                  placementId: "invalid-slot",
                  children: [],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(invalid.valid).toBeFalse();
    expect(invalid.issues.some((issue) => issue.code === StudioAssetCompositionValidationIssueCodes.slotCardinalityExceeded)).toBeTrue();
    expect(invalid.issues.some((issue) => issue.code === StudioAssetCompositionValidationIssueCodes.childKindNotAllowed)).toBeTrue();
    expect(invalid.issues.some((issue) => issue.code === StudioAssetCompositionValidationIssueCodes.invalidNesting)).toBeTrue();
    expect(invalid.issues.some((issue) => issue.code === StudioAssetCompositionValidationIssueCodes.atomicCannotContainChildren)).toBeTrue();
  });

  it("serializes and deserializes composed and system-page trees through registry-backed lookup", () => {
    const registry = createDefaultStudioAssetRegistry();
    const composition = {
      nodeId: "system-root",
      assetId: "system-studio",
      config: {
        mode: "embedded",
      },
      metadataReferences: {
        draftId: "draft-1",
        regionId: "workspace",
      },
      regions: [
        {
          placementId: "navigation",
          children: [{ nodeId: "nav-viewer", assetId: "ui-primitive:viewer" }],
        },
        {
          placementId: "workspace",
          children: [{
            nodeId: "workflow-child",
            assetId: "workflow-studio",
            slots: [{ placementId: "main", children: [{ nodeId: "workflow-main-viewer", assetId: "ui-primitive:viewer" }] }],
          }],
        },
        {
          placementId: "inspector",
          children: [{ nodeId: "inspector-toggle", assetId: "ui-primitive:toggle" }],
        },
      ],
    } as const;

    const serialized = registry.serializeCompositionTree(composition);
    const parsed = registry.deserializeCompositionTree({ serialized });

    expect(parsed.validation.valid).toBeTrue();
    expect(parsed.root.assetId).toBe("system-studio");
    expect(parsed.root.assetVersion).toBe("1.0.0");
    expect(parsed.root.regions?.map((entry) => entry.placementId)).toEqual(["navigation", "workspace", "inspector"]);
    expect(parsed.root.regions?.[1]?.children[0]?.assetId).toBe("workflow-studio");
    expect(parsed.root.regions?.[1]?.children[0]?.assetVersion).toBe("1.0.0");
  });

  it("migrates legacy composition payloads and preserves version-aware validation", () => {
    const registry = createDefaultStudioAssetRegistry();
    const serializedLegacy = JSON.stringify({
      root: {
        nodeId: "legacy-root",
        assetId: "workflow-studio",
        slots: [{
          placementId: "main",
          children: [{
            nodeId: "legacy-viewer",
            assetId: "ui-primitive:viewer",
          }],
        }],
      },
    });

    const migrated = registry.deserializeCompositionTree({ serialized: serializedLegacy });
    expect(migrated.validation.valid).toBeTrue();
    expect(migrated.root.assetVersion).toBe("1.0.0");
    expect(migrated.root.slots?.[0]?.children[0]?.assetVersion).toBe("1.0.0");

    const mismatched = registry.deserializeCompositionTree({
      serialized: JSON.stringify({
        schemaVersion: "1.1.0",
        root: {
          nodeId: "root",
          assetId: "workflow-studio",
          assetVersion: "0.9.0",
          slots: [{
            placementId: "main",
            children: [{ nodeId: "viewer", assetId: "ui-primitive:viewer", assetVersion: "0.9.0" }],
          }],
        },
      }),
      validate: false,
    });

    expect(mismatched.validation.valid).toBeFalse();
    expect(mismatched.validation.issues.some((issue) => issue.code === StudioAssetCompositionValidationIssueCodes.assetVersionMismatch)).toBeTrue();
  });
});
