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

  it("does not shadow the image manipulation template with duplicate template or system asset ids", () => {
    const sameTemplateId = SystemBuildTemplateCatalog.filter((entry) => (
      entry.templateId === ImageManipulationSystemTemplate.templateId
    ));
    const sameSystemAssetId = SystemBuildTemplateCatalog.filter((entry) => (
      entry.draftSeed.assetId === ImageManipulationSystemTemplate.systemAsset.assetId
    ));

    expect(sameTemplateId).toHaveLength(1);
    expect(sameSystemAssetId).toHaveLength(1);
  });

  it("seeds system studio defaults with workflow and dataset composition content", () => {
    const entry = SystemBuildTemplateCatalog[0];
    const parsed = JSON.parse(entry?.draftSeed.contentTemplate ?? "{}") as {
      readonly systemSpec?: {
        readonly components?: ReadonlyArray<{ readonly assetId: string }>;
        readonly bindings?: ReadonlyArray<{ readonly bindingId: string }>;
        readonly canvasAuthoring?: {
          readonly pageLayouts?: ReadonlyArray<{
            readonly panels?: ReadonlyArray<{
              readonly content?: {
                readonly kind?: string;
                readonly studioAssetId?: string;
              };
            }>;
          }>;
        };
      };
    };

    expect(parsed.systemSpec?.components?.map((component) => component.assetId)).toContain(
      ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
    );
    expect(parsed.systemSpec?.components?.map((component) => component.assetId)).toContain(
      ImageManipulationSystemTemplate.datasetInstances[0]?.datasetAssetId,
    );
    expect(parsed.systemSpec?.bindings?.length ?? 0).toBeGreaterThan(0);
    expect(parsed.systemSpec?.canvasAuthoring?.pageLayouts?.[0]?.panels?.[0]?.content?.kind).toBe("embedded-studio");
    expect(parsed.systemSpec?.canvasAuthoring?.pageLayouts?.[0]?.panels?.[0]?.content?.studioAssetId).toBe(
      ImageManipulationSystemTemplate.compositionBindings.pageBindingId,
    );
  });

  it("returns undefined for unregistered template ids in the Build flow lookup path", () => {
    expect(resolveSystemBuildTemplate("template:system:not-registered")).toBeUndefined();
    expect(resolveSystemBuildTemplate("   ")).toBeUndefined();
    expect(resolveSystemBuildTemplate(undefined)).toBeUndefined();
  });
});
