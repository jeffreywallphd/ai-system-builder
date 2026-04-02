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
    expect(composed.length).toBeGreaterThanOrEqual(3);
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
});
