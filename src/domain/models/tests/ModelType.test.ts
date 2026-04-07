import { describe, expect, it } from "bun:test";
import { ModelTypeHelper } from "../ModelType";

describe("ModelTypeHelper", () => {
  it("maps model kinds to expected types", () => {
    expect(ModelTypeHelper.fromKind("chat-model")).toBe("language");
    expect(ModelTypeHelper.fromKind("lora")).toBe("adapter");
    expect(ModelTypeHelper.fromKind("tokenizer")).toBe("support-asset");
    expect(ModelTypeHelper.fromKind("postprocessor")).toBe("utility");
  });

  it("validates and normalizes type strings", () => {
    expect(ModelTypeHelper.isValid("IMAGE_GENERATION")).toBeTrue();
    expect(ModelTypeHelper.normalize("IMAGE_GENERATION")).toBe("image-generation");
    expect(ModelTypeHelper.normalize("unknown-type")).toBeUndefined();
  });

  it("matches values case-insensitively and safely", () => {
    expect(ModelTypeHelper.matches("speech", "SPEECH")).toBeTrue();
    expect(ModelTypeHelper.matches("support_asset", "support-asset")).toBeTrue();
    expect(ModelTypeHelper.matches("speech", null)).toBeFalse();
    expect(ModelTypeHelper.matches("speech", "not-a-type")).toBeFalse();
  });

  it("exposes category predicates", () => {
    expect(ModelTypeHelper.isLanguage("completion-model")).toBeTrue();
    expect(ModelTypeHelper.isEmbedding("embedding-model")).toBeTrue();
    expect(ModelTypeHelper.isRanking("reranker-model")).toBeTrue();
    expect(ModelTypeHelper.isClassification("classifier-model")).toBeTrue();
    expect(ModelTypeHelper.isSpeech("speech-to-text-model")).toBeTrue();
    expect(ModelTypeHelper.isVision("vision-model")).toBeTrue();
    expect(ModelTypeHelper.isImageGeneration("image-generation-model")).toBeTrue();
    expect(ModelTypeHelper.isVideoGeneration("video-generation-model")).toBeTrue();
    expect(ModelTypeHelper.isMultimodal("multimodal-model")).toBeTrue();
    expect(ModelTypeHelper.isAdapter("adapter")).toBeTrue();
    expect(ModelTypeHelper.isSupportAsset("vae")).toBeTrue();
    expect(ModelTypeHelper.isUtility("preprocessor")).toBeTrue();
  });

  it("determines runnable kinds correctly", () => {
    expect(ModelTypeHelper.isRunnableKind("chat-model")).toBeTrue();
    expect(ModelTypeHelper.isRunnableKind("vae")).toBeFalse();
    expect(ModelTypeHelper.isRunnableKind("utility-asset")).toBeFalse();
    expect(ModelTypeHelper.isRunnableKind("generic")).toBeFalse();
  });
});
