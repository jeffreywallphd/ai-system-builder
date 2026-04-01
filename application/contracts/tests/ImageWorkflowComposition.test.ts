import { describe, expect, it } from "bun:test";
import { ImageWorkflowAssetIntentTypes } from "../ImageWorkflowAssetContract";
import {
  createImageWorkflowComposition,
  createReusableImagePipeline,
  ImageWorkflowCompositionStageKinds,
  usesNodeKind,
} from "../ImageWorkflowComposition";

describe("ImageWorkflowComposition", () => {
  it("builds a reusable and inspectable composition pipeline", () => {
    const composition = createReusableImagePipeline({
      compositionId: "pipeline.image-to-image.default",
      intentType: ImageWorkflowAssetIntentTypes.imageToImage,
      previewMode: "comparison",
      inputBindings: [
        {
          id: "in.sourceImage",
          fieldId: "sourceImage",
          source: "input",
          description: "source",
        },
      ],
      outputBindings: [
        {
          id: "out.images",
          fieldId: "images",
          source: "system",
          description: "result",
        },
      ],
      stages: [
        {
          id: "stage.transform",
          kind: ImageWorkflowCompositionStageKinds.transform,
          title: "Transform",
          description: "Apply transform",
          steps: [
            {
              id: "step.sampler",
              title: "Sampler",
              nodeKind: "sampler-wrapper",
              consumes: ["sourceImage"],
              produces: ["images"],
            },
          ],
        },
      ],
    });

    expect(composition.metadata.reusable).toBeTrue();
    expect(composition.stages[0]?.inspectable).toBeTrue();
    expect(Object.isFrozen(composition)).toBeTrue();
    expect(usesNodeKind(composition, "sampler-wrapper")).toBeTrue();
  });

  it("validates required composition shape", () => {
    expect(() => createImageWorkflowComposition({
      compositionId: "x",
      intentType: "image-to-image",
      version: { compositionVersion: "1.0.0" },
      bindings: { inputs: [], outputs: [] },
      adapterBoundary: { adapterId: "adapter", adapterContractVersion: "1.0.0" },
      stages: [],
      metadata: { reusable: true, preview: { mode: "single", inspectableStageIds: [] }, tags: [] },
    })).toThrow();
  });
});
