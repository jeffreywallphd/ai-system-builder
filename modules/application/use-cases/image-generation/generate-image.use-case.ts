import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import { TaskType, type CancelRuntimeTaskResult, type RuntimeTaskRecord } from "../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";

import type { ApplicationRequestContext } from "../../ports";

export interface StartImageGenerationResult {
  requestId: string;
  status?: "queued" | "running";
  metadata?: Record<string, unknown>;
}

function assertValidPrompt(request: ImageGenerationRequest): void {
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    throw new Error("Image generation requires a non-empty prompt.");
  }
}

export class GenerateImageUseCase {
  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
    },
  ) {}

  public async startImageGeneration(
    request: ImageGenerationRequest,
    context?: ApplicationRequestContext,
  ): Promise<StartImageGenerationResult> {
    assertValidPrompt(request);

    const result = await this.dependencies.runtimeTaskRegistry.startTask({
      taskType: TaskType.IMAGE_GENERATION,
      payload: request,
      requestId: context?.requestId,
    });

    return {
      requestId: result.requestId,
      status: result.status,
      metadata: result.metadata,
    };
  }

  public async readImageGeneration(requestId: string, _context?: ApplicationRequestContext): Promise<RuntimeTaskRecord> {
    return this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);
  }

  public async cancelImageGeneration(requestId: string, _context?: ApplicationRequestContext): Promise<CancelRuntimeTaskResult> {
    return this.dependencies.runtimeTaskRegistry.cancelTask(requestId);
  }
}
