import { describe, expect, it } from "bun:test";
import { createUiTriggerEvent, UiTriggerEventKinds } from "../UiTriggerEventContract";
import { createDefaultUiTriggerSystemContextMapper } from "../UiTriggerSystemContextMapper";

describe("UiTriggerSystemContextMapper", () => {
  it("maps selected image, form parameters, dataset references, and runtime context into execution context metadata", () => {
    const mapper = createDefaultUiTriggerSystemContextMapper();
    const event = createUiTriggerEvent({
      kind: UiTriggerEventKinds.submit,
      name: "ui.image.parameter.submit",
      source: {
        studio: "system-studio",
        componentId: "parameter-form",
        actionId: "submit",
      },
      payload: {
        imageId: "asset:image:selected-1",
        values: {
          prompt: "repair scratches",
        },
      },
      context: {
        datasetAssetId: "dataset:input-images",
        datasetVersionId: "v2",
        systemAssetId: "system:image-pipeline",
        references: {
          datasetInstanceId: "instance:active-input",
          systemDatasetInstanceId: "instance:system-output",
          systemDatasetRole: "output-image-store",
          runtimeSessionId: "runtime-session:123",
        },
      },
    });

    const mapped = mapper.map(event);
    const metadata = mapped.metadata as Record<string, unknown>;
    expect((mapped.inputValues as Record<string, unknown>).prompt).toBe("repair scratches");
    expect((metadata.systemFormValues as Record<string, unknown>).prompt).toBe("repair scratches");
    expect((metadata.selectedImage as Record<string, unknown>).imageId).toBe("asset:image:selected-1");
    expect((metadata.datasetInstances as Array<Record<string, unknown>>)[0]?.instanceId).toBe("instance:active-input");
    expect((metadata.systemDatasetInstanceRefs as Array<Record<string, unknown>>)[0]?.instanceId).toBe("instance:system-output");
    expect((metadata.runtimeContext as Record<string, unknown>).runtimeSessionId).toBe("runtime-session:123");
  });
});
