import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import {
  TaskType,
  type CancelRuntimeTaskResult,
  type RuntimeTaskStatusRecord,
  type StartRuntimeTaskResult,
} from "../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";
import type { RuntimeCapabilityGuardService } from "../../services/runtime";
import type { ModelCheckpointResolverPort } from "../../ports/model";

import type { ApplicationRequestContext } from "../../ports";

function assertValidPrompt(request: ImageGenerationRequest): void {
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    throw new Error("Image generation requires a non-empty prompt.");
  }
  if (request.cfg !== undefined && (!Number.isFinite(request.cfg) || request.cfg <= 0)) {
    throw new Error("Image generation CFG must be a positive finite number.");
  }
  if (request.denoise !== undefined && (!Number.isFinite(request.denoise) || request.denoise < 0 || request.denoise > 1)) {
    throw new Error("Image generation denoise must be between 0 and 1.");
  }
  if (request.latentSource?.kind === "artifact" && request.latentSource.artifactId.trim().length === 0) {
    throw new Error("Image generation latent artifact id is required when using an artifact latent source.");
  }
}

export class GenerateImageUseCase {
  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
      modelCheckpointResolver?: ModelCheckpointResolverPort;
      runtimeCapabilityGuard?: Pick<RuntimeCapabilityGuardService, "requireCapabilityReady">;
    },
  ) {}

  public async startImageGeneration(
    request: ImageGenerationRequest,
    context?: ApplicationRequestContext,
  ): Promise<StartRuntimeTaskResult> {
    assertValidPrompt(request);
    await this.dependencies.runtimeCapabilityGuard?.requireCapabilityReady("image-generation");

    const resolvedModel = await this.dependencies.modelCheckpointResolver?.resolveCheckpoint({
      selectedModel: request.model,
      taskTag: "text-to-image",
    });
    const payload = resolvedModel?.checkpoint
      ? { ...request, model: resolvedModel.checkpoint }
      : request;

    const result = await this.dependencies.runtimeTaskRegistry.startTask({
      taskType: TaskType.IMAGE_GENERATION,
      payload,
      requestId: context?.requestId,
    });

    return result;
  }

  public async readImageGeneration(requestId: string, _context?: ApplicationRequestContext): Promise<RuntimeTaskStatusRecord> {
    return this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);
  }

  public async cancelImageGeneration(requestId: string, _context?: ApplicationRequestContext): Promise<CancelRuntimeTaskResult> {
    return this.dependencies.runtimeTaskRegistry.cancelTask(requestId);
  }
}
