import { describe, expect, it } from "bun:test";
import { ImageManipulationSystemTemplate } from "../ImageManipulationSystemTemplate";
import {
  resolveSystemBuildTemplate,
  SystemBuildTemplateCatalog,
} from "../SystemBuildTemplateCatalog";

describe("SystemBuildTemplateCatalog", () => {
  it("registers the image manipulation system template for Build flow selection", () => {
    const entry = resolveSystemBuildTemplate(ImageManipulationSystemTemplate.templateId);

    expect(entry?.templateId).toBe(ImageManipulationSystemTemplate.templateId);
    expect(entry?.card.title).toBe("Image Manipulation System");
    expect(entry?.draftSeed.assetId).toBe(ImageManipulationSystemTemplate.systemAsset.assetId);
    expect(entry?.draftSeed.dependencies.some((dependency) => (
      dependency.assetId === ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId
    ))).toBeTrue();
  });

  it("seeds system studio defaults with workflow and dataset composition content", () => {
    const entry = SystemBuildTemplateCatalog[0];
    const parsed = JSON.parse(entry?.draftSeed.contentTemplate ?? "{}") as {
      readonly systemSpec?: {
        readonly components?: ReadonlyArray<{ readonly assetId: string }>;
        readonly bindings?: ReadonlyArray<{ readonly bindingId: string }>;
      };
    };

    expect(parsed.systemSpec?.components?.map((component) => component.assetId)).toContain(
      ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
    );
    expect(parsed.systemSpec?.components?.map((component) => component.assetId)).toContain(
      ImageManipulationSystemTemplate.datasetInstances[0]?.datasetAssetId,
    );
    expect(parsed.systemSpec?.bindings?.length ?? 0).toBeGreaterThan(0);
  });
});
