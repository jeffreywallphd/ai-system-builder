import type { ImageGenerationRequest } from "../../../contracts/image-generation";

export interface ComfyUiImageGenerationWorkflowMapperOptions {
  defaultCheckpoint?: string;
  defaultWidth?: number;
  defaultHeight?: number;
  defaultSteps?: number;
  latentReferenceImageName?: string;
  defaultSampler?: string;
  defaultScheduler?: string;
}

export interface ComfyUiPromptPayload {
  prompt: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
}

export function mapImageGenerationRequestToComfyUiPrompt(
  request: ImageGenerationRequest,
  options: ComfyUiImageGenerationWorkflowMapperOptions,
): ComfyUiPromptPayload {
  const checkpoint = request.model ?? options.defaultCheckpoint;
  if (!checkpoint) {
    throw new Error("ComfyUI image generation requires a model checkpoint. Provide request.model or defaultCheckpoint.");
  }

  const width = request.width ?? options.defaultWidth ?? 1024;
  const height = request.height ?? options.defaultHeight ?? 1024;
  const steps = request.steps ?? options.defaultSteps ?? 30;
  const cfg = request.cfg ?? 8;
  const denoise = request.denoise ?? 1;
  const sampler = request.sampler ?? options.defaultSampler ?? "dpmpp_2m";
  const scheduler = request.scheduler ?? options.defaultScheduler ?? "karras";
  const seed = request.seed ?? (Math.floor(Math.random() * Number.MAX_SAFE_INTEGER) + 1);
  const controlAfterGenerate = request.seed === undefined ? "randomize" : "fixed";
  const hasLatentReference = request.latentSource?.kind === "artifact" && Boolean(options.latentReferenceImageName);
  const faceIdReferences = (request.faceId?.enabled ? request.faceId.references : undefined) ?? [];
  const hasFaceId = faceIdReferences.length > 0;
  const latentSource = hasLatentReference ? ["10", 0] : ["4", 0];
  const positiveSource: [string, number] = hasFaceId ? ["16", 0] : ["2", 0];

  const prompt: ComfyUiPromptPayload["prompt"] = {
      "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
      "2": { class_type: "CLIPTextEncode", inputs: { text: request.prompt, clip: ["1", 1] } },
      "3": { class_type: "CLIPTextEncode", inputs: { text: request.negativePrompt ?? "", clip: ["1", 1] } },
      "4": { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: request.numImages ?? 1 } },
      "5": {
        class_type: "KSampler",
        inputs: {
          seed,
          control_after_generate: controlAfterGenerate,
          steps,
          cfg,
          sampler_name: sampler,
          scheduler,
          denoise,
          model: ["1", 0],
          positive: positiveSource,
          negative: ["3", 0],
          latent_image: latentSource,
        },
      },
      "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
      "7": { class_type: "SaveImage", inputs: { filename_prefix: "ai-system-builder", images: ["6", 0] } },
  };

  if (request.latentSource?.kind === "artifact" && options.latentReferenceImageName) {
    prompt["8"] = { class_type: "LoadImage", inputs: { image: options.latentReferenceImageName } };
    prompt["9"] = { class_type: "ResizeAndPadImage", inputs: { image: ["8", 0], target_width: width, target_height: height, padding_color: "black", interpolation: "area" } };
    prompt["10"] = { class_type: "VAEEncode", inputs: { pixels: ["9", 0], vae: ["1", 2] } };
  }
  if (hasFaceId) {
    prompt["11"] = { class_type: "LoadImage", inputs: { image: faceIdReferences[0]!.artifactId } };
    prompt["12"] = { class_type: "InstantIDModelLoader", inputs: { instantid_file: "ip-adapter.bin" } };
    prompt["13"] = { class_type: "InsightFaceLoader", inputs: { provider: "CPU" } };
    prompt["14"] = { class_type: "CLIPVisionLoader", inputs: { clip_name: "ViT-H-14-laion2B-s32B-b79K.safetensors" } };
    prompt["15"] = { class_type: "IPAdapterFaceID", inputs: { model: ["1", 0], ipadapter: ["12", 0], image: ["11", 0], clip_vision: ["14", 0], insightface: ["13", 0], weight: request.faceId?.identityStrength ?? 0.85, weight_faceidv2: request.faceId?.structureStrength ?? 0.75, noise: request.faceId?.noise ?? 0.35 } };
    prompt["16"] = { class_type: "ConditioningCombine", inputs: { conditioning_1: ["2", 0], conditioning_2: ["15", 0] } };
  }

  return { prompt };
}

