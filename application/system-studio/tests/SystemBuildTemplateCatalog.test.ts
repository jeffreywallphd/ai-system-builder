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
    expect(entry?.draftSeed.metadataPatch.contract).toBeDefined();
    expect(entry?.completenessValidation.runnable).toBeTrue();
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
        readonly executionMetadata?: {
          readonly runtime?: { readonly environment?: string };
          readonly orchestration?: { readonly mode?: string };
        };
        readonly serialization?: {
          readonly runtime?: {
            readonly datasetInstances?: ReadonlyArray<{
              readonly instanceId?: string;
              readonly datasetAssetId?: string;
            }>;
            readonly workflowBindings?: ReadonlyArray<{
              readonly bindingId?: string;
              readonly workflowAssetId?: string;
            }>;
            readonly state?: {
              readonly defaultGenerationSettings?: { readonly resultCount?: number };
              readonly defaultPrompts?: { readonly positivePrompt?: string };
              readonly defaultModelRefs?: { readonly checkpointModel?: string; readonly vaeModel?: string };
            };
          };
        };
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
    expect(parsed.systemSpec?.executionMetadata?.runtime?.environment).toBe("comfyui");
    expect(parsed.systemSpec?.executionMetadata?.orchestration?.mode).toBe("workflow-template-driven");
    expect(parsed.systemSpec?.serialization?.runtime?.workflowBindings?.some((entry) => (
      entry.bindingId === ImageManipulationSystemTemplate.primaryWorkflowAsset.bindingId
      && entry.workflowAssetId === ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId
    ))).toBeTrue();
    expect(parsed.systemSpec?.serialization?.runtime?.datasetInstances?.some((entry) => (
      entry.instanceId === ImageManipulationSystemTemplate.datasetInstances[0]?.instanceId
      && entry.datasetAssetId === ImageManipulationSystemTemplate.datasetInstances[0]?.datasetAssetId
    ))).toBeTrue();
    expect(parsed.systemSpec?.serialization?.runtime?.state?.defaultGenerationSettings?.resultCount).toBe(1);
    expect(parsed.systemSpec?.serialization?.runtime?.state?.defaultPrompts?.positivePrompt?.length ?? 0).toBeGreaterThan(0);
    expect(parsed.systemSpec?.serialization?.runtime?.state?.defaultModelRefs?.checkpointModel?.length ?? 0).toBeGreaterThan(0);
    expect(parsed.systemSpec?.serialization?.runtime?.state?.defaultModelRefs?.vaeModel?.length ?? 0).toBeGreaterThan(0);
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
