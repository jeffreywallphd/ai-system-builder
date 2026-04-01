import type { WorkflowTemplateDefinition } from "../../domain/workflow-template-studio/WorkflowTemplateDomain";

function createCoreTemplate(input: WorkflowTemplateDefinition): WorkflowTemplateDefinition {
  return Object.freeze(input);
}

export const CoreImageStarterWorkflowTemplates: ReadonlyArray<WorkflowTemplateDefinition> = Object.freeze([
  createCoreTemplate({
    templateId: "asset:workflow-template:image-to-image:starter",
    versionId: "asset:workflow-template:image-to-image:starter:v1",
    name: "Image to image starter",
    summary: "Transform one source image with bounded prompt + strength controls.",
    category: "image-editing",
    supportedIntent: "image-to-image",
    inputRequirements: [
      { inputId: "sourceImage", valueType: "image", required: true, description: "Source image to transform." },
      { inputId: "instruction", valueType: "text", required: false, description: "Optional text instruction." },
    ],
    outputExpectations: [
      { outputId: "images", valueType: "images", description: "Transformed image outputs." },
    ],
    parameterDefaults: [
      { parameterId: "variationStrength", value: 0.5, description: "How strongly to diverge from source." },
      { parameterId: "resultCount", value: 1, description: "Number of images to generate." },
    ],
    parameters: [
      { parameterId: "variationStrength", name: "Variation strength", type: "number", required: true, defaultValue: 0.5, validation: { min: 0, max: 1 } },
      { parameterId: "resultCount", name: "Result count", type: "integer", required: true, defaultValue: 1, validation: { min: 1, max: 4 } },
    ],
    composition: {
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:image-to-image", inputIds: ["sourceImage", "instruction"], outputIds: ["images"], parameterIds: ["variationStrength", "resultCount"] }],
      inputBindings: [
        { bindingId: "starter:image-to-image:input:source", templateInputId: "sourceImage", workflowAssetId: "asset:workflow:image-to-image", workflowInputId: "sourceImage", required: true },
        { bindingId: "starter:image-to-image:input:instruction", templateInputId: "instruction", workflowAssetId: "asset:workflow:image-to-image", workflowInputId: "instruction", required: false },
      ],
      outputBindings: [
        { bindingId: "starter:image-to-image:output:images", templateOutputId: "images", workflowAssetId: "asset:workflow:image-to-image", workflowOutputId: "images" },
      ],
      parameterMappings: [
        { parameterId: "variationStrength", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "variationStrength" },
        { parameterId: "resultCount", workflowAssetId: "asset:workflow:image-to-image", workflowParameterId: "resultCount" },
      ],
    },
    workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:image-to-image", versionId: "asset:workflow:image-to-image:v1" }],
    tags: ["starter", "image-to-image", "transform"],
    metadata: { category: "transform", intent: "image-to-image" },
  }),
  createCoreTemplate({
    templateId: "asset:workflow-template:restyle:starter",
    versionId: "asset:workflow-template:restyle:starter:v1",
    name: "Restyle starter",
    summary: "Apply a style preset with minimal style controls.",
    category: "image-style-transfer",
    supportedIntent: "image-to-image",
    inputRequirements: [
      { inputId: "sourceImage", valueType: "image", required: true, description: "Image to restyle." },
      { inputId: "stylePreset", valueType: "text", required: true, description: "Style preset/prompt." },
    ],
    outputExpectations: [{ outputId: "images", valueType: "images", description: "Restyled output images." }],
    parameterDefaults: [{ parameterId: "styleStrength", value: 0.65 }, { parameterId: "variationStrength", value: 0.45 }],
    parameters: [
      { parameterId: "styleStrength", name: "Style strength", type: "number", required: true, defaultValue: 0.65, validation: { min: 0, max: 1 } },
      { parameterId: "variationStrength", name: "Variation strength", type: "number", required: true, defaultValue: 0.45, validation: { min: 0, max: 1 } },
    ],
    composition: {
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:restyle", inputIds: ["sourceImage", "stylePreset"], outputIds: ["images"], parameterIds: ["styleStrength", "variationStrength"] }],
      inputBindings: [
        { bindingId: "starter:restyle:input:source", templateInputId: "sourceImage", workflowAssetId: "asset:workflow:restyle", workflowInputId: "sourceImage", required: true },
        { bindingId: "starter:restyle:input:preset", templateInputId: "stylePreset", workflowAssetId: "asset:workflow:restyle", workflowInputId: "stylePreset", required: true },
      ],
      outputBindings: [{ bindingId: "starter:restyle:output:images", templateOutputId: "images", workflowAssetId: "asset:workflow:restyle", workflowOutputId: "images" }],
      parameterMappings: [
        { parameterId: "styleStrength", workflowAssetId: "asset:workflow:restyle", workflowParameterId: "styleStrength" },
        { parameterId: "variationStrength", workflowAssetId: "asset:workflow:restyle", workflowParameterId: "variationStrength" },
      ],
    },
    workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:restyle", versionId: "asset:workflow:restyle:v1" }],
    tags: ["starter", "restyle", "transform"],
    metadata: { category: "transform", intent: "restyle" },
  }),
  createCoreTemplate({
    templateId: "asset:workflow-template:enhance-upscale:starter",
    versionId: "asset:workflow-template:enhance-upscale:starter:v1",
    name: "Enhance/upscale starter",
    summary: "Enhance one image with a simple upscale factor + denoise surface.",
    category: "image-upscaling",
    supportedIntent: "upscaling",
    inputRequirements: [{ inputId: "sourceImage", valueType: "image", required: true, description: "Image to enhance/upscale." }],
    outputExpectations: [{ outputId: "enhancedImage", valueType: "image", description: "Enhanced image output." }],
    parameterDefaults: [{ parameterId: "scaleFactor", value: 2 }, { parameterId: "denoise", value: 0.15 }],
    parameters: [
      { parameterId: "scaleFactor", name: "Upscale factor", type: "number", required: true, defaultValue: 2, validation: { min: 1, max: 4 } },
      { parameterId: "denoise", name: "Denoise", type: "number", required: true, defaultValue: 0.15, validation: { min: 0, max: 1 } },
    ],
    composition: {
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:enhance-upscale", inputIds: ["sourceImage"], outputIds: ["enhancedImage"], parameterIds: ["scaleFactor", "denoise"] }],
      inputBindings: [{ bindingId: "starter:enhance:input:source", templateInputId: "sourceImage", workflowAssetId: "asset:workflow:enhance-upscale", workflowInputId: "sourceImage", required: true }],
      outputBindings: [{ bindingId: "starter:enhance:output:image", templateOutputId: "enhancedImage", workflowAssetId: "asset:workflow:enhance-upscale", workflowOutputId: "enhancedImage" }],
      parameterMappings: [
        { parameterId: "scaleFactor", workflowAssetId: "asset:workflow:enhance-upscale", workflowParameterId: "scaleFactor" },
        { parameterId: "denoise", workflowAssetId: "asset:workflow:enhance-upscale", workflowParameterId: "denoise" },
      ],
    },
    workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:enhance-upscale", versionId: "asset:workflow:enhance-upscale:v1" }],
    tags: ["starter", "enhancement", "upscale"],
    metadata: { category: "enhancement", intent: "enhance-upscale" },
  }),
  createCoreTemplate({
    templateId: "asset:workflow-template:batch-transform:starter",
    versionId: "asset:workflow-template:batch-transform:starter:v1",
    name: "Batch transform starter",
    summary: "Transform multiple images with one shared instruction.",
    category: "image-variation",
    supportedIntent: "image-to-image",
    inputRequirements: [
      { inputId: "batchItems", valueType: "json", required: true, description: "Input image batch list." },
      { inputId: "instruction", valueType: "text", required: false, description: "Shared instruction for every item." },
    ],
    outputExpectations: [{ outputId: "images", valueType: "images", description: "Transformed outputs for each batch item." }],
    parameterDefaults: [{ parameterId: "concurrency", value: 4 }, { parameterId: "resultCountPerItem", value: 1 }],
    parameters: [
      { parameterId: "concurrency", name: "Concurrency", type: "integer", required: true, defaultValue: 4, validation: { min: 1, max: 12 } },
      { parameterId: "resultCountPerItem", name: "Result count per item", type: "integer", required: true, defaultValue: 1, validation: { min: 1, max: 4 } },
    ],
    composition: {
      workflowInterfaces: [{ workflowAssetId: "asset:workflow:batch-transform", inputIds: ["batchItems", "instruction"], outputIds: ["images"], parameterIds: ["concurrency", "resultCountPerItem"] }],
      inputBindings: [
        { bindingId: "starter:batch:input:items", templateInputId: "batchItems", workflowAssetId: "asset:workflow:batch-transform", workflowInputId: "batchItems", required: true },
        { bindingId: "starter:batch:input:instruction", templateInputId: "instruction", workflowAssetId: "asset:workflow:batch-transform", workflowInputId: "instruction", required: false },
      ],
      outputBindings: [{ bindingId: "starter:batch:output:images", templateOutputId: "images", workflowAssetId: "asset:workflow:batch-transform", workflowOutputId: "images" }],
      parameterMappings: [
        { parameterId: "concurrency", workflowAssetId: "asset:workflow:batch-transform", workflowParameterId: "concurrency" },
        { parameterId: "resultCountPerItem", workflowAssetId: "asset:workflow:batch-transform", workflowParameterId: "resultCountPerItem" },
      ],
    },
    workflowAssets: [{ role: "workflow-definition", assetId: "asset:workflow:batch-transform", versionId: "asset:workflow:batch-transform:v1" }],
    tags: ["starter", "batch", "transform"],
    metadata: { category: "transform", intent: "batch-transform" },
  }),
]);
