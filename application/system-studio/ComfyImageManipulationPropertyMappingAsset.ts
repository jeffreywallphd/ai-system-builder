import { z } from "zod";
import {
  ComfyImageManipulationPropertySchemaId,
  ComfyImageManipulationPropertySchemaVersion,
  type ComfyImageManipulationConfig,
  resolveComfyImageManipulationConfig,
} from "./ComfyImageManipulationPropertySchema";
import {
  ComfyImageManipulationBaseGraphAssetId,
  ComfyImageManipulationBaseGraphContractVersion,
  ComfyImageManipulationBaseGraphVersionId,
} from "./ComfyImageManipulationBaseGraph";

export const ComfyImageManipulationPropertyMappingAssetId = "asset:config-profile:comfy-image-manipulation-property-mapping";
export const ComfyImageManipulationPropertyMappingVersionId = "asset:config-profile:comfy-image-manipulation-property-mapping:v1";
export const ComfyImageManipulationPropertyMappingContractVersion = "1.0.0";

const BindingGroups = Object.freeze({
  prompts: "prompts",
  generation: "generation-controls",
  models: "model-controls",
  image: "image-controls",
  faceId: "faceid-controls",
} as const);

type BindingGroup = typeof BindingGroups[keyof typeof BindingGroups];
const BindingGroupValues = [
  BindingGroups.prompts,
  BindingGroups.generation,
  BindingGroups.models,
  BindingGroups.image,
  BindingGroups.faceId,
] as const;

const bindingSchema = z.object({
  bindingId: z.string().trim().min(1),
  group: z.enum(BindingGroupValues),
  schemaPath: z.string().trim().min(1),
  graphNodeId: z.string().trim().min(1),
  graphInputName: z.string().trim().min(1),
  required: z.boolean().default(true),
  extensionHook: z.boolean().default(false),
  notes: z.string().trim().optional(),
});

export type ComfyImageManipulationPropertyBinding = z.infer<typeof bindingSchema>;

export interface ComfyImageManipulationPropertyMappingAsset {
  readonly assetId: typeof ComfyImageManipulationPropertyMappingAssetId;
  readonly versionId: typeof ComfyImageManipulationPropertyMappingVersionId;
  readonly contractVersion: typeof ComfyImageManipulationPropertyMappingContractVersion;
  readonly summary: string;
  readonly inputContract: {
    readonly propertySchemaId: typeof ComfyImageManipulationPropertySchemaId;
    readonly propertySchemaVersion: typeof ComfyImageManipulationPropertySchemaVersion;
    readonly configValueType: "comfy-image-manipulation-config";
  };
  readonly outputContract: {
    readonly graphAssetId: typeof ComfyImageManipulationBaseGraphAssetId;
    readonly graphVersionId: typeof ComfyImageManipulationBaseGraphVersionId;
    readonly graphContractVersion: typeof ComfyImageManipulationBaseGraphContractVersion;
    readonly bindingValueType: "comfy-graph-input-bindings";
  };
  readonly configSurface: {
    readonly supportsPromptBindings: true;
    readonly supportsGenerationBindings: true;
    readonly supportsModelBindings: true;
    readonly supportsImageBindings: true;
    readonly supportsFaceIdBindings: true;
    readonly faceIdExtensionReady: true;
    readonly advancedSettingsExtensionReady: true;
    readonly faceIdCompositionBindingId: "faceid-conditioning";
  };
  readonly bindings: ReadonlyArray<ComfyImageManipulationPropertyBinding>;
}

export const ComfyImageManipulationPropertyMappingAsset: ComfyImageManipulationPropertyMappingAsset = Object.freeze({
  assetId: ComfyImageManipulationPropertyMappingAssetId,
  versionId: ComfyImageManipulationPropertyMappingVersionId,
  contractVersion: ComfyImageManipulationPropertyMappingContractVersion,
  summary: "Maps image manipulation property-schema fields into Comfy base-graph node parameter bindings.",
  inputContract: Object.freeze({
    propertySchemaId: ComfyImageManipulationPropertySchemaId,
    propertySchemaVersion: ComfyImageManipulationPropertySchemaVersion,
    configValueType: "comfy-image-manipulation-config",
  }),
  outputContract: Object.freeze({
    graphAssetId: ComfyImageManipulationBaseGraphAssetId,
    graphVersionId: ComfyImageManipulationBaseGraphVersionId,
    graphContractVersion: ComfyImageManipulationBaseGraphContractVersion,
    bindingValueType: "comfy-graph-input-bindings",
  }),
  configSurface: Object.freeze({
    supportsPromptBindings: true,
    supportsGenerationBindings: true,
    supportsModelBindings: true,
    supportsImageBindings: true,
    supportsFaceIdBindings: true,
    faceIdExtensionReady: true,
    advancedSettingsExtensionReady: true,
    faceIdCompositionBindingId: "faceid-conditioning",
  }),
  bindings: Object.freeze([
    Object.freeze({ bindingId: "binding.prompt.positive", group: BindingGroups.prompts, schemaPath: "prompts.positivePrompt", graphNodeId: "4", graphInputName: "text" }),
    Object.freeze({ bindingId: "binding.prompt.negative", group: BindingGroups.prompts, schemaPath: "prompts.negativePrompt", graphNodeId: "5", graphInputName: "text" }),
    Object.freeze({ bindingId: "binding.generation.seed", group: BindingGroups.generation, schemaPath: "generation.seed", graphNodeId: "6", graphInputName: "seed" }),
    Object.freeze({ bindingId: "binding.generation.steps", group: BindingGroups.generation, schemaPath: "generation.steps", graphNodeId: "6", graphInputName: "steps" }),
    Object.freeze({ bindingId: "binding.generation.cfg", group: BindingGroups.generation, schemaPath: "generation.cfg", graphNodeId: "6", graphInputName: "cfg" }),
    Object.freeze({ bindingId: "binding.generation.sampler", group: BindingGroups.generation, schemaPath: "generation.sampler", graphNodeId: "6", graphInputName: "sampler_name" }),
    Object.freeze({ bindingId: "binding.generation.scheduler", group: BindingGroups.generation, schemaPath: "generation.scheduler", graphNodeId: "6", graphInputName: "scheduler" }),
    Object.freeze({ bindingId: "binding.generation.denoise", group: BindingGroups.generation, schemaPath: "generation.denoiseStrength", graphNodeId: "6", graphInputName: "denoise" }),
    Object.freeze({ bindingId: "binding.model.checkpoint", group: BindingGroups.models, schemaPath: "models.checkpointModel", graphNodeId: "1", graphInputName: "ckpt_name" }),
    Object.freeze({ bindingId: "binding.model.vae", group: BindingGroups.models, schemaPath: "models.vaeModel", graphNodeId: "9", graphInputName: "vae_name" }),
    Object.freeze({
      bindingId: "binding.image.source",
      group: BindingGroups.image,
      schemaPath: "image.sourceImage",
      graphNodeId: "2",
      graphInputName: "image",
      required: false,
      extensionHook: true,
      notes: "Source image binding resolves through logical dataset references at runtime.",
    }),
    Object.freeze({
      bindingId: "binding.image.result-count-extension",
      group: BindingGroups.image,
      schemaPath: "output.resultCount",
      graphNodeId: "6",
      graphInputName: "batch_size",
      required: false,
      extensionHook: true,
      notes: "Reserved for advanced graph variants that expose explicit batch sizing.",
    }),
    Object.freeze({
      bindingId: "binding.faceid.enabled-extension",
      group: BindingGroups.faceId,
      schemaPath: "faceId.enabled",
      graphNodeId: "6",
      graphInputName: "faceid_enabled",
      required: false,
      extensionHook: true,
      notes: "Reserved for optional FaceID conditioning composition.",
    }),
    Object.freeze({
      bindingId: "binding.faceid.references-extension",
      group: BindingGroups.faceId,
      schemaPath: "faceId.referenceBindings",
      graphNodeId: "faceid-conditioning",
      graphInputName: "references",
      required: false,
      extensionHook: true,
      notes: "Logical FaceID dataset reference bindings for optional FaceID conditioning composition.",
    }),
    Object.freeze({
      bindingId: "binding.faceid.weight-extension",
      group: BindingGroups.faceId,
      schemaPath: "faceId.weight",
      graphNodeId: "faceid-conditioning",
      graphInputName: "weight",
      required: false,
      extensionHook: true,
      notes: "FaceID conditioning weight control binding.",
    }),
    Object.freeze({
      bindingId: "binding.faceid.start-step-extension",
      group: BindingGroups.faceId,
      schemaPath: "faceId.startStepFraction",
      graphNodeId: "faceid-conditioning",
      graphInputName: "start_step_fraction",
      required: false,
      extensionHook: true,
      notes: "FaceID conditioning start-timing control binding.",
    }),
    Object.freeze({
      bindingId: "binding.faceid.end-step-extension",
      group: BindingGroups.faceId,
      schemaPath: "faceId.endStepFraction",
      graphNodeId: "faceid-conditioning",
      graphInputName: "end_step_fraction",
      required: false,
      extensionHook: true,
      notes: "FaceID conditioning end-timing control binding.",
    }),
  ]),
});

export interface FaceIdSubworkflowBinding {
  readonly subworkflowId: "faceid-conditioning";
  readonly enabled: boolean;
  readonly referenceBindings: ReadonlyArray<{
    readonly datasetBindingId: string;
    readonly datasetAssetId: string;
  }>;
  readonly weight: number;
  readonly startStepFraction: number;
  readonly endStepFraction: number;
}

export interface ResolveComfyImageManipulationGraphBindingsResult {
  readonly graphBindings: Readonly<Record<string, unknown>>;
  readonly extensionBindings: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly subworkflowBindings: ReadonlyArray<FaceIdSubworkflowBinding>;
}

function readConfigPath(config: Readonly<Record<string, unknown>>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = config;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

export function resolveComfyImageManipulationGraphBindings(
  input: unknown,
): ResolveComfyImageManipulationGraphBindingsResult {
  const resolvedConfig = resolveComfyImageManipulationConfig(input) as unknown as Readonly<Record<string, unknown>>;
  const graphBindings: Record<string, unknown> = {};
  const extensionBindings: Array<Readonly<Record<string, unknown>>> = [];

  for (const rawBinding of ComfyImageManipulationPropertyMappingAsset.bindings) {
    const binding = bindingSchema.parse(rawBinding);
    const value = readConfigPath(resolvedConfig, binding.schemaPath);
    if (value === undefined || value === null) {
      if (binding.required) {
        throw new Error(`Comfy property binding '${binding.bindingId}' requires schema path '${binding.schemaPath}'.`);
      }
      continue;
    }
    if (binding.extensionHook) {
      extensionBindings.push(Object.freeze({
        bindingId: binding.bindingId,
        nodeId: binding.graphNodeId,
        inputName: binding.graphInputName,
        value,
        group: binding.group as BindingGroup,
      }));
      continue;
    }
    graphBindings[`${binding.graphNodeId}.${binding.graphInputName}`] = value;
  }

  const faceIdSubworkflowBinding: FaceIdSubworkflowBinding = Object.freeze({
    subworkflowId: "faceid-conditioning",
    enabled: Boolean(readConfigPath(resolvedConfig, "faceId.enabled")),
    referenceBindings: Object.freeze((readConfigPath(resolvedConfig, "faceId.referenceBindings") as ReadonlyArray<{
      readonly datasetBindingId: string;
      readonly datasetAssetId: string;
    }> | undefined) ?? []),
    weight: Number(readConfigPath(resolvedConfig, "faceId.weight") ?? 0.8),
    startStepFraction: Number(readConfigPath(resolvedConfig, "faceId.startStepFraction") ?? 0),
    endStepFraction: Number(readConfigPath(resolvedConfig, "faceId.endStepFraction") ?? 1),
  });

  return Object.freeze({
    graphBindings: Object.freeze(graphBindings),
    extensionBindings: Object.freeze(extensionBindings),
    subworkflowBindings: Object.freeze([faceIdSubworkflowBinding]),
  });
}
