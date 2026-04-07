import type {
  RuntimeCapabilityProviderTranslator,
} from "../../../../application/system-runtime/RuntimeCapabilityExecutionPreflight";

export interface ComfyRuntimeExecutionConfiguration {
  readonly checkpointBindingId: string;
  readonly samplerName: string;
  readonly scheduler: "normal";
  readonly steps: number;
  readonly cfg: number;
  readonly width: number;
  readonly height: number;
  readonly denoise: number;
  readonly seed: number;
  readonly batchSize: number;
  readonly device: "auto" | "cpu" | "gpu";
  readonly precision: "auto" | "fp16" | "bf16" | "fp32";
}

const COMFY_SUPPORTED_SAMPLERS = new Set(["euler", "dpmpp_2m", "euler_a", "lms"]);

export class ComfyRuntimeCapabilityTranslator
implements RuntimeCapabilityProviderTranslator<ComfyRuntimeExecutionConfiguration> {
  public translate(input: Parameters<RuntimeCapabilityProviderTranslator<ComfyRuntimeExecutionConfiguration>["translate"]>[0]) {
    const sampler = input.resolvedExecutionOptions.sampler;
    if (!sampler || !COMFY_SUPPORTED_SAMPLERS.has(sampler)) {
      return Object.freeze({
        ok: false as const,
        code: "unsupported-comfy-sampler",
        message: `ComfyUI does not support sampler '${sampler ?? "unknown"}' in this adapter profile.`,
        diagnostics: Object.freeze({ sampler }),
      });
    }

    const resolution = input.resolvedExecutionOptions.resolution;
    if (!resolution) {
      return Object.freeze({
        ok: false as const,
        code: "missing-comfy-resolution",
        message: "ComfyUI translation requires explicit resolution values.",
      });
    }

    return Object.freeze({
      ok: true as const,
      providerConfig: Object.freeze({
        checkpointBindingId: input.modelBinding.bindingId ?? "",
        samplerName: sampler,
        scheduler: "normal" as const,
        steps: input.resolvedExecutionOptions.steps ?? 20,
        cfg: input.resolvedExecutionOptions.guidanceScale ?? 7,
        width: resolution.width,
        height: resolution.height,
        denoise: 1,
        seed: input.resolvedExecutionOptions.seed?.mode === "deterministic"
          ? input.resolvedExecutionOptions.seed.value
          : 0,
        batchSize: input.resolvedExecutionOptions.batch?.count ?? 1,
        device: input.resolvedExecutionOptions.runtime?.device ?? "auto",
        precision: input.resolvedExecutionOptions.runtime?.precision ?? "auto",
      }),
    });
  }
}
