export type ImageGenerationLatentSource =
  | { kind: "empty" }
  | { kind: "artifact"; artifactId: string };

export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  denoise?: number;
  sampler?: string;
  scheduler?: string;
  model?: string;
  numImages?: number;
  latentSource?: ImageGenerationLatentSource;
  engineHints?: Record<string, unknown>;
}
