import type { WorkflowTemplateDefinition } from "../../domain/workflow-template-studio/WorkflowTemplateDomain";
import { createComfyImageManipulationDefaultConfig } from "../system-studio/ComfyImageManipulationPropertySchema";
import {
  ComfyImageManipulationBaseGraphAssetId,
  ComfyImageManipulationBaseGraphVersionId,
  ComfyImageManipulationBaseGraphContractVersion,
} from "../system-studio/ComfyImageManipulationBaseGraph";
import {
  ImageManipulationFaceIdReferenceDatasetAssetId,
  ImageManipulationInputDatasetAssetId,
  ImageManipulationOutputDatasetAssetId,
} from "../dataset-studio/ImageManipulationDatasetAssets";

export const ImageManipulationWorkflowTemplateAssetId = "asset:workflow-template:image-manipulation:default";
export const ImageManipulationWorkflowTemplateVersionId = "asset:workflow-template:image-manipulation:default:v1";

const defaultConfig = createComfyImageManipulationDefaultConfig();

export const ImageManipulationWorkflowTemplate: WorkflowTemplateDefinition = Object.freeze({
  templateId: ImageManipulationWorkflowTemplateAssetId,
  versionId: ImageManipulationWorkflowTemplateVersionId,
  name: "Image manipulation default",
  summary: "Default runnable image manipulation workflow template backed by a Comfy img2img base graph.",
  category: "image-editing",
  supportedIntent: "image-to-image",
  inputRequirements: Object.freeze([
    Object.freeze({
      inputId: "sourceImage",
      valueType: "image",
      required: true,
      description: "Source image selected in the system context.",
    }),
    Object.freeze({
      inputId: "instruction",
      valueType: "text",
      required: false,
      description: "Positive edit instruction text shown to non-technical users.",
    }),
  ]),
  outputExpectations: Object.freeze([
    Object.freeze({
      outputId: "images",
      valueType: "images",
      description: "Edited images produced by the Comfy-backed img2img flow.",
    }),
  ]),
  parameterDefaults: Object.freeze([
    Object.freeze({ parameterId: "negativePrompt", value: defaultConfig.prompts.negativePrompt }),
    Object.freeze({ parameterId: "steps", value: defaultConfig.generation.steps }),
    Object.freeze({ parameterId: "cfg", value: defaultConfig.generation.cfg }),
    Object.freeze({ parameterId: "denoiseStrength", value: defaultConfig.generation.denoiseStrength }),
    Object.freeze({ parameterId: "sampler", value: defaultConfig.generation.sampler }),
    Object.freeze({ parameterId: "scheduler", value: defaultConfig.generation.scheduler }),
    Object.freeze({ parameterId: "seed", value: defaultConfig.generation.seed }),
    Object.freeze({ parameterId: "resultCount", value: defaultConfig.output.resultCount }),
    Object.freeze({ parameterId: "checkpointModel", value: defaultConfig.models.checkpointModel }),
    Object.freeze({ parameterId: "vaeModel", value: defaultConfig.models.vaeModel }),
    Object.freeze({ parameterId: "faceIdEnabled", value: defaultConfig.faceId.enabled }),
  ]),
  parameters: Object.freeze([
    Object.freeze({ parameterId: "negativePrompt", name: "Avoid in output", type: "string", required: true, defaultValue: defaultConfig.prompts.negativePrompt }),
    Object.freeze({ parameterId: "steps", name: "Steps", type: "integer", required: true, defaultValue: defaultConfig.generation.steps, validation: { min: 1, max: 200 } }),
    Object.freeze({ parameterId: "cfg", name: "Guidance", type: "number", required: true, defaultValue: defaultConfig.generation.cfg, validation: { min: 1, max: 30 } }),
    Object.freeze({ parameterId: "denoiseStrength", name: "Edit strength", type: "number", required: true, defaultValue: defaultConfig.generation.denoiseStrength, validation: { min: 0, max: 1 } }),
    Object.freeze({ parameterId: "sampler", name: "Sampler", type: "enum", required: true, defaultValue: defaultConfig.generation.sampler, validation: { enumValues: ["euler", "dpmpp_2m", "euler_a", "lms"] } }),
    Object.freeze({ parameterId: "scheduler", name: "Scheduler", type: "enum", required: true, defaultValue: defaultConfig.generation.scheduler, validation: { enumValues: ["normal", "karras", "exponential", "sgm_uniform"] } }),
    Object.freeze({ parameterId: "seed", name: "Seed", type: "integer", required: true, defaultValue: defaultConfig.generation.seed, validation: { min: 0, max: 2147483647 } }),
    Object.freeze({ parameterId: "resultCount", name: "Result count", type: "integer", required: true, defaultValue: defaultConfig.output.resultCount, validation: { min: 1, max: 4 } }),
    Object.freeze({ parameterId: "checkpointModel", name: "Checkpoint model", type: "string", required: true, defaultValue: defaultConfig.models.checkpointModel }),
    Object.freeze({ parameterId: "vaeModel", name: "VAE model", type: "string", required: true, defaultValue: defaultConfig.models.vaeModel }),
    Object.freeze({ parameterId: "faceIdEnabled", name: "Enable FaceID", type: "boolean", required: true, defaultValue: defaultConfig.faceId.enabled }),
  ]),
  composition: Object.freeze({
    contractVersion: "1.0.0",
    workflowInterfaces: Object.freeze([
      Object.freeze({
        workflowAssetId: "asset:workflow:image-to-image",
        workflowAssetVersionId: "asset:workflow:image-to-image:v1",
        inputIds: ["sourceImage", "instruction"],
        outputIds: ["images"],
        parameterIds: [
          "negativePrompt",
          "steps",
          "cfg",
          "denoiseStrength",
          "sampler",
          "scheduler",
          "seed",
          "resultCount",
          "checkpointModel",
          "vaeModel",
          "faceIdEnabled",
        ],
      }),
    ]),
    inputBindings: Object.freeze([
      Object.freeze({
        bindingId: "image-manipulation:input:source-image",
        templateInputId: "sourceImage",
        workflowAssetId: "asset:workflow:image-to-image",
        workflowInputId: "sourceImage",
        required: true,
      }),
      Object.freeze({
        bindingId: "image-manipulation:input:instruction",
        templateInputId: "instruction",
        workflowAssetId: "asset:workflow:image-to-image",
        workflowInputId: "instruction",
        required: false,
      }),
    ]),
    outputBindings: Object.freeze([
      Object.freeze({
        bindingId: "image-manipulation:output:images",
        templateOutputId: "images",
        workflowAssetId: "asset:workflow:image-to-image",
        workflowOutputId: "images",
        targetDatasetAssetId: ImageManipulationOutputDatasetAssetId,
      }),
    ]),
    parameterMappings: Object.freeze([
      Object.freeze({ parameterId: "negativePrompt", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "negativePrompt" }),
      Object.freeze({ parameterId: "steps", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "steps" }),
      Object.freeze({ parameterId: "cfg", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "cfg" }),
      Object.freeze({ parameterId: "denoiseStrength", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "denoiseStrength" }),
      Object.freeze({ parameterId: "sampler", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "sampler" }),
      Object.freeze({ parameterId: "scheduler", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "scheduler" }),
      Object.freeze({ parameterId: "seed", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "seed" }),
      Object.freeze({ parameterId: "resultCount", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "resultCount" }),
      Object.freeze({ parameterId: "checkpointModel", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "checkpointModel" }),
      Object.freeze({ parameterId: "vaeModel", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "vaeModel" }),
      Object.freeze({ parameterId: "faceIdEnabled", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "faceIdEnabled" }),
    ]),
    systemContextMappings: Object.freeze([
      Object.freeze({
        mappingId: "image-manipulation.context.positive-prompt",
        contextKey: "editInstruction",
        workflowAssetId: "asset:workflow:image-to-image",
        targetKind: "workflow-input",
        targetId: "instruction",
      }),
      Object.freeze({
        mappingId: "image-manipulation.context.faceid-references",
        contextKey: "faceIdReferenceDataset",
        workflowAssetId: "asset:workflow:image-to-image",
        targetKind: "workflow-parameter",
        targetId: "faceIdEnabled",
      }),
    ]),
  }),
  workflowAssets: Object.freeze([
    Object.freeze({ role: "workflow-definition", assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v1" }),
    Object.freeze({ role: "dataset", assetId: ImageManipulationInputDatasetAssetId }),
    Object.freeze({ role: "dataset", assetId: ImageManipulationOutputDatasetAssetId }),
    Object.freeze({ role: "dataset", assetId: ImageManipulationFaceIdReferenceDatasetAssetId }),
    Object.freeze({ role: "config-profile", assetId: ComfyImageManipulationBaseGraphAssetId, versionId: ComfyImageManipulationBaseGraphVersionId }),
  ]),
  tags: Object.freeze(["default", "image-manipulation", "img2img", "comfyui"]),
  metadata: Object.freeze({
    category: "image-manipulation",
    intent: "image-to-image",
    runtimeEnvironment: "comfyui",
    executionMode: "workflow-template-driven",
    baseGraphAssetId: ComfyImageManipulationBaseGraphAssetId,
    baseGraphVersionId: ComfyImageManipulationBaseGraphVersionId,
    baseGraphContractVersion: ComfyImageManipulationBaseGraphContractVersion,
    supportsFaceIdExtension: "true",
    inspectPreviewMode: "comparison",
    defaultExecutable: "true",
  }),
});
