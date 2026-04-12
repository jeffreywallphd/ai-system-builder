import { describe, expect, it } from "bun:test";
import { ImageManipulationSystemTemplate } from "@application/system-studio/ImageManipulationSystemTemplate";
import {
  createDefaultStudioAssetRegistry,
  StudioAssetRendererResolutionKinds,
} from "../StudioAssetRegistry";

describe("StudioAssetRegistry", () => {
  it("registers and resolves the image editor runtime page asset in the default registry", () => {
    const registry = createDefaultStudioAssetRegistry();
    const registration = registry.getById(ImageManipulationSystemTemplate.compositionBindings.pageBindingId);
    const renderer = registry.resolveRendererById(ImageManipulationSystemTemplate.compositionBindings.pageBindingId);

    expect(registration?.metadata.assetType).toBe(ImageManipulationSystemTemplate.compositionBindings.pageBindingId);
    expect(registration?.kind).toBe("atomic");
    expect(renderer.kind).toBe(StudioAssetRendererResolutionKinds.resolved);
    expect(typeof renderer.render).toBe("function");
  });
});


