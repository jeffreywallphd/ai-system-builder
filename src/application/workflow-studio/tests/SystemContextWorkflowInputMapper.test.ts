import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "@domain/system-studio/SystemContextContract";
import { createSystemContextWorkflowMappingConfiguration } from "@domain/system-studio/SystemContextWorkflowMappingConfiguration";
import { ReferenceImageSystemWorkflowContextMapping } from "../../system-studio/ReferenceImageSystemTemplate";
import { createDefaultWorkflowSystemContextBindingAdapter } from "../SystemContextWorkflowInputMapper";

describe("SystemContextWorkflowInputMapper", () => {
  it("maps system context contract into workflow execution input bindings metadata", () => {
    const adapter = createDefaultWorkflowSystemContextBindingAdapter();
    const context = createSystemContextContract({
      parameters: {
        prompt: "repair scratches",
        strength: 0.5,
      },
      selectedImages: [{
        selectionId: "selected-1",
        imageId: "asset:image:selected-1",
        assetRef: {
          assetId: "asset:image:selected-1",
        },
      }],
      datasets: [{
        referenceId: "active",
        instanceId: "instance:active-input",
        role: "active-input",
        datasetAssetId: "dataset:input-images",
        datasetVersionId: "v2",
        systemAssetId: "system:image-pipeline",
      }, {
        referenceId: "system-output",
        instanceId: "instance:system-output",
        role: "system-owned-output",
        datasetAssetId: "dataset:output-images",
      }],
      runtime: {
        runtimeSessionId: "runtime-session:123",
        workflowRunId: "run:456",
      },
    });

    const mapped = adapter.map(context);
    const metadata = mapped.metadata as Record<string, unknown>;

    expect((mapped.inputValues as Record<string, unknown>).prompt).toBe("repair scratches");
    expect((metadata.systemFormValues as Record<string, unknown>).strength).toBe(0.5);
    expect((metadata.selectedImage as Record<string, unknown>).imageId).toBe("asset:image:selected-1");
    expect((metadata.datasetInstances as Array<Record<string, unknown>>)[0]?.instanceId).toBe("instance:active-input");
    expect((metadata.datasetRuntimeHandles as Array<Record<string, unknown>>)[0]?.kind).toBe("dataset-instance");
    expect((metadata.systemDatasetInstanceRefs as Array<Record<string, unknown>>)[0]?.instanceId).toBe("instance:system-output");
    expect((metadata.datasetResolution as Record<string, unknown>).resolvedCount).toBe(2);
    expect((metadata.runtimeContext as Record<string, unknown>).runtimeSessionId).toBe("runtime-session:123");
    expect((metadata.systemContextMapping as { appliedMappings: unknown[] }).appliedMappings.length).toBeGreaterThan(0);
  });

  it("supports reusable explicit mapping configuration for system/ui/image/dataset binding targets", () => {
    const adapter = createDefaultWorkflowSystemContextBindingAdapter({
      mappingConfiguration: createSystemContextWorkflowMappingConfiguration({
        mappings: [
          {
            mappingId: "map.ui.prompt",
            sourceRoot: "parameters",
            sourcePath: "prompt",
            targetKind: "workflow-input",
            targetPath: "workflowPrompt",
            required: true,
          },
          {
            mappingId: "map.image.asset",
            sourceRoot: "selected-image",
            sourcePath: "assetRef.assetId",
            targetKind: "workflow-metadata",
            targetPath: "debug.selectedImageAssetId",
            required: true,
          },
          {
            mappingId: "map.dataset.ref",
            sourceRoot: "datasets",
            sourcePath: "[0].referenceId",
            targetKind: "workflow-input",
            targetPath: "activeDatasetReferenceId",
            required: true,
          },
          {
            mappingId: "map.dataset.instance-handles",
            sourceRoot: "dataset-resolution",
            targetKind: "workflow-metadata",
            targetPath: "datasetRuntimeHandles",
            transformId: "dataset-runtime-handles",
          },
        ],
      }),
    });

    const mapped = adapter.map(createSystemContextContract({
      parameters: { prompt: "refine shadows" },
      selectedImages: [{ selectionId: "selected", imageId: "img-1", assetRef: { assetId: "asset:img-1" } }],
      datasets: [{ referenceId: "dataset-active", instanceId: "instance:active", role: "active-input", datasetAssetId: "dataset:images" }],
    }));

    expect((mapped.inputValues as Record<string, unknown>).workflowPrompt).toBe("refine shadows");
    expect((mapped.inputValues as Record<string, unknown>).activeDatasetReferenceId).toBe("dataset-active");
    expect((((mapped.metadata as Record<string, unknown>).debug as Record<string, unknown>).selectedImageAssetId)).toBe("asset:img-1");
    expect((((mapped.metadata as Record<string, unknown>).datasetRuntimeHandles as Array<Record<string, unknown>>)[0] as Record<string, unknown>).instanceId).toBe("instance:active");
  });

  it("maps reference-image system context into primary workflow inputs + dataset metadata", () => {
    const adapter = createDefaultWorkflowSystemContextBindingAdapter({
      mappingConfiguration: ReferenceImageSystemWorkflowContextMapping,
    });

    const mapped = adapter.map(createSystemContextContract({
      parameters: {
        editInstruction: "remove scratches and warm up colors",
        variationStrength: 0.6,
        resultCount: 2,
      },
      selectedImages: [{
        selectionId: "selected-main",
        imageId: "asset:image:selected-main",
        assetRef: {
          assetId: "asset:image:selected-main",
        },
      }],
      datasets: [{
        referenceId: "dataset-input",
        instanceId: "dataset-instance:reference-image:input",
        role: "system-owned-input",
        datasetAssetId: "asset:dataset:image-reference-input",
      }, {
        referenceId: "dataset-output",
        instanceId: "dataset-instance:reference-image:output",
        role: "system-owned-output",
        datasetAssetId: "asset:dataset:image-reference-output",
      }],
      runtime: {
        runtimeSessionId: "runtime:reference-image",
      },
    }));

    const inputs = mapped.inputValues as Record<string, unknown>;
    const metadata = mapped.metadata as Record<string, unknown>;
    expect(inputs.sourceImage).toBe("asset:image:selected-main");
    expect(inputs.instruction).toBe("remove scratches and warm up colors");
    expect(inputs.variationStrength).toBe(0.6);
    expect(inputs.resultCount).toBe(2);
    expect((metadata.datasetInstances as Array<Record<string, unknown>>).length).toBe(2);
    expect((metadata.systemDatasetInstanceRefs as Array<Record<string, unknown>>)[0]?.instanceId).toBe("dataset-instance:reference-image:input");
    expect((metadata.datasetRuntimeHandles as Array<Record<string, unknown>>)[0]?.kind).toBe("dataset-instance");
    expect((metadata.runtimeContext as Record<string, unknown>).runtimeSessionId).toBe("runtime:reference-image");
  });
});

