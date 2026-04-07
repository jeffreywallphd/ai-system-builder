import { describe, expect, it } from "bun:test";
import {
  ImageAssetReferenceKinds,
  createImageAssetReference,
} from "../contracts/ImageAssetReference";

describe("ImageAssetReference", () => {
  it("normalizes local file references", () => {
    const reference = createImageAssetReference({
      kind: ImageAssetReferenceKinds.localFile,
      path: "C:\\images\\sample.png",
    });

    expect(reference.kind).toBe(ImageAssetReferenceKinds.localFile);
    if (reference.kind !== ImageAssetReferenceKinds.localFile) {
      throw new Error("Expected local file reference.");
    }
    expect(reference.path).toBe("C:\\images\\sample.png");
    expect(reference.stableId).toContain("local-file:");
  });

  it("normalizes generated output references", () => {
    const reference = createImageAssetReference({
      kind: ImageAssetReferenceKinds.generatedOutput,
      outputId: "run-1:image-4",
      sourceSystem: "workflow-runtime",
    });

    expect(reference.kind).toBe(ImageAssetReferenceKinds.generatedOutput);
    if (reference.kind !== ImageAssetReferenceKinds.generatedOutput) {
      throw new Error("Expected generated output reference.");
    }
    expect(reference.outputId).toBe("run-1:image-4");
    expect(reference.sourceSystem).toBe("workflow-runtime");
  });

  it("normalizes external uri references", () => {
    const reference = createImageAssetReference({
      kind: ImageAssetReferenceKinds.externalUri,
      uri: "https://example.com/image.jpg",
      mimeTypeHint: "IMAGE/JPEG",
    });

    expect(reference.kind).toBe(ImageAssetReferenceKinds.externalUri);
    if (reference.kind !== ImageAssetReferenceKinds.externalUri) {
      throw new Error("Expected external URI reference.");
    }
    expect(reference.uri).toBe("https://example.com/image.jpg");
    expect(reference.mimeTypeHint).toBe("image/jpeg");
  });
});
