import { describe, expect, it } from "bun:test";
import { createUiTriggerEvent, UiTriggerEventKinds } from "../UiTriggerEventContract";
import { createDefaultUiTriggerSystemContextMapper } from "../UiTriggerSystemContextMapper";

describe("UiTriggerSystemContextMapper", () => {
  it("maps selected image, parameters, dataset references, and runtime metadata into the system context contract", () => {
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
    expect(mapped.parameters.prompt).toBe("repair scratches");
    expect(mapped.selectedImages[0]?.imageId).toBe("asset:image:selected-1");
    expect(mapped.datasets[0]?.instanceId).toBe("instance:active-input");
    expect(mapped.datasets[1]?.instanceId).toBe("instance:system-output");
    expect(mapped.runtime.runtimeSessionId).toBe("runtime-session:123");
    expect(mapped.runtime.systemAssetId).toBe("system:image-pipeline");
  });
});
