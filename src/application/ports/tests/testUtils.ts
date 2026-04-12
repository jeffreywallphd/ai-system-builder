import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { IModel } from "@domain/models/interfaces/IModel";
import type { INodeDefinition } from "@domain/nodes/interfaces/INodeDefinition";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";

export function makeModel(overrides: Partial<IModel> = {}): IModel {
  const base: IModel = {
    id: "model-1",
    name: "Model One",
    kind: "checkpoint",
    architecture: "sdxl",
    architectureFamily: "stable-diffusion",
    isRunnable: true,
    source: {
      type: "huggingface",
      sourceId: "org/model-1",
      repository: "org/model-1",
    },
    artifact: {
      name: "weights.safetensors",
      accessMethod: "download-url",
      location: "/models/model-1",
    },
    compatibility: {
      supportedTasks: ["text-to-image"],
      inputModalities: ["text"],
      outputModalities: ["image"],
      supportedRuntimes: ["comfyui"],
      allowsAnyRuntime: false,
      allowsRuntime(runtime: string): boolean {
        return this.allowsAnyRuntime || this.supportedRuntimes.includes(runtime as never);
      },
      supportsTask(task: string): boolean {
        return this.supportedTasks.includes(task as never);
      },
      supportsInputModality(modality: string): boolean {
        return this.inputModalities.includes(modality as never);
      },
      supportsOutputModality(modality: string): boolean {
        return this.outputModalities.includes(modality as never);
      },
      withTask(task: string) {
        return {
          ...this,
          supportedTasks: [...this.supportedTasks, task as never],
        };
      },
      withRuntime(runtime: string) {
        return {
          ...this,
          supportedRuntimes: [...this.supportedRuntimes, runtime as never],
        };
      },
      withInputModality(modality: string) {
        return {
          ...this,
          inputModalities: [...this.inputModalities, modality as never],
        };
      },
      withOutputModality(modality: string) {
        return {
          ...this,
          outputModalities: [...this.outputModalities, modality as never],
        };
      },
      withAnyRuntimeEnabled() {
        return { ...this, allowsAnyRuntime: true };
      },
    },
    tags: ["anime", "image"],
    languageCodes: ["en"],
  } as IModel;

  return { ...base, ...overrides };
}

export function makeNodeDefinition(
  id: string,
  overrides: Partial<INodeDefinition> = {}
): INodeDefinition {
  const base: INodeDefinition = {
    id,
    type: `${id}.type`,
    title: `${id} Title`,
    description: `${id} description`,
    category: "generation",
    executionKind: "normal",
    inputPorts: [],
    outputPorts: [],
    properties: [],
    capabilities: {
      tasks: ["text-to-image"],
      runtimes: ["comfyui"],
      allowsAnyRuntime: false,
    },
    isVisibleInBasicMode: true,
    isModelAware(): boolean {
      return (this.properties ?? []).some((p: any) => p.bindingProfile?.isModelSelector);
    },
  } as INodeDefinition;

  return { ...base, ...overrides };
}

export function makeWorkflow(overrides: Partial<IWorkflow> = {}): IWorkflow {
  return {
    id: "wf-1",
    name: "Workflow",
    nodes: [],
    connections: [],
    runtimeProfile: { preferredRuntime: "comfyui" },
    ...overrides,
  } as IWorkflow;
}

export function makeAsset(overrides: Partial<IAsset> = {}): IAsset {
  return {
    id: "asset-1",
    name: "Asset",
    type: "image",
    metadata: {},
    ...overrides,
  } as IAsset;
}

