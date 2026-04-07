import { describe, expect, it } from "bun:test";
import { ImageManipulationSystemTemplate } from "../../../../application/system-studio/ImageManipulationSystemTemplate";
import { StudioUiAssetKinds } from "../StudioAssetContracts";
import { imageManipulationEditorPageAssetDefinition } from "../ImageManipulationEditorPageAsset";

describe("ImageManipulationEditorPageAsset", () => {
  it("registers a runtime page asset using the system template page binding id", () => {
    expect(imageManipulationEditorPageAssetDefinition.contract.identity.studioType).toBe(
      ImageManipulationSystemTemplate.compositionBindings.pageBindingId,
    );
    expect(imageManipulationEditorPageAssetDefinition.contract.kind).toBe(StudioUiAssetKinds.atomic);
    expect(imageManipulationEditorPageAssetDefinition.contract.supportedModes).toContain("embedded");
  });
});
