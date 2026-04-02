import { describe, expect, it } from "bun:test";
import { createSystemContextContract } from "../../../domain/system-studio/SystemContextContract";
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
    expect((metadata.systemDatasetInstanceRefs as Array<Record<string, unknown>>)[0]?.instanceId).toBe("instance:system-output");
    expect((metadata.runtimeContext as Record<string, unknown>).runtimeSessionId).toBe("runtime-session:123");
  });
});
