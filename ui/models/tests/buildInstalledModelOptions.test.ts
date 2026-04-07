import { describe, expect, it } from "bun:test";
import { attachInstalledModelOptions, buildInstalledModelOptions } from "../buildInstalledModelOptions";
import { ModelCompatibility } from "../../../src/domain/models/ModelCompatibility";

const baseModel: any = {
  isRunnable: true,
  status: "ready",
  source: { type: "huggingface" },
  artifact: { name: "model.safetensors", accessMethod: "remote-download", format: "safetensors" },
  additionalArtifacts: [],
  dependencies: [],
  requirements: [],
  tags: [],
  languageCodes: [],
  requiresAuth: false,
  isAvailable(): boolean {
    return true;
  },
  isSupportingAsset(): boolean {
    return false;
  },
  supportsTask(task: string): boolean {
    return this.compatibility.supportsTask(task as never);
  },
  supportsInputModality(modality: string): boolean {
    return this.compatibility.supportsInputModality(modality as never);
  },
  supportsOutputModality(modality: string): boolean {
    return this.compatibility.supportsOutputModality(modality as never);
  },
  isCompatibleWith(target: { supportedTasks: ReadonlyArray<string> }): boolean {
    return target.supportedTasks.some((task) => this.compatibility.supportsTask(task as never));
  },
  satisfiesRequirements(): boolean {
    return true;
  },
  toReferenceString(): string {
    return this.id;
  },
};

describe("buildInstalledModelOptions", () => {
  it("filters model selectors to node-compatible installed models", () => {
    const options = buildInstalledModelOptions([
      {
        ...baseModel,
        id: "llm-1",
        name: "General LLM",
        kind: "chat-model",
        compatibility: new ModelCompatibility({
          supportedTasks: ["chat", "text-generation"],
          inputModalities: ["text"],
          outputModalities: ["text"],
          supportedRuntimes: ["generic"],
          allowsAnyRuntime: true,
          allowsAnyArchitectureFamily: true,
        }),
      } as any,
      {
        ...baseModel,
        id: "tts-1",
        name: "Voice Model",
        kind: "text-to-speech-model",
        compatibility: new ModelCompatibility({
          supportedTasks: ["text-to-speech"],
          inputModalities: ["text"],
          outputModalities: ["audio"],
          supportedRuntimes: ["generic"],
          allowsAnyRuntime: true,
          allowsAnyArchitectureFamily: true,
        }),
      } as any,
      {
        ...baseModel,
        id: "embed-1",
        name: "Embedding Model",
        kind: "embedding-model",
        compatibility: new ModelCompatibility({
          supportedTasks: ["embedding"],
          inputModalities: ["text"],
          outputModalities: ["generic"],
          supportedRuntimes: ["generic"],
          allowsAnyRuntime: true,
          allowsAnyArchitectureFamily: true,
        }),
      } as any,
    ]);

    const llmField = attachInstalledModelOptions(
      {
        id: "model",
        name: "Model",
        type: "text",
        editorType: "model",
        value: "",
        isEditable: true,
        isAdvanced: false,
        isEmpty: true,
        shouldClampToRange: false,
        visibility: "basic",
        modelSelection: { tasks: ["chat", "text-generation"], outputModalities: ["text"] },
      },
      options,
    );

    const embeddingField = attachInstalledModelOptions(
      {
        id: "embeddingModel",
        name: "Embedding Model",
        type: "text",
        editorType: "model",
        value: "",
        isEditable: true,
        isAdvanced: false,
        isEmpty: true,
        shouldClampToRange: false,
        visibility: "basic",
        modelSelection: { tasks: ["embedding"], inputModalities: ["text"] },
      },
      options,
    );

    expect(llmField.options?.map((option) => option.value)).toEqual(["llm-1"]);
    expect(embeddingField.options?.map((option) => option.value)).toEqual(["embed-1"]);
  });
});
