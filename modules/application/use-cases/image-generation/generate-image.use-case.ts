import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import {
  TaskType,
  type CancelRuntimeTaskResult,
  type RuntimeTaskRecord,
  type StartRuntimeTaskResult,
} from "../../../contracts/runtime";
import type { RuntimeTaskRegistryPort } from "../../ports/runtime";
import type { FinalizeImageGenerationService } from "../../services/image/finalize-image-generation.service";

import type { ApplicationRequestContext } from "../../ports";

function assertValidPrompt(request: ImageGenerationRequest): void {
  if (typeof request.prompt !== "string" || request.prompt.trim().length === 0) {
    throw new Error("Image generation requires a non-empty prompt.");
  }
}

export class GenerateImageUseCase {
  public constructor(
    private readonly dependencies: {
      runtimeTaskRegistry: RuntimeTaskRegistryPort;
      finalizeImageGenerationService: FinalizeImageGenerationService;
    },
  ) {}

  public async startImageGeneration(
    request: ImageGenerationRequest,
    context?: ApplicationRequestContext,
  ): Promise<StartRuntimeTaskResult> {
    assertValidPrompt(request);

    const result = await this.dependencies.runtimeTaskRegistry.startTask({
      taskType: TaskType.IMAGE_GENERATION,
      payload: request,
      requestId: context?.requestId,
    });

    return result;
  }

  public async readImageGeneration(requestId: string, _context?: ApplicationRequestContext): Promise<RuntimeTaskRecord> {
    const task = await this.dependencies.runtimeTaskRegistry.getTaskStatus(requestId);

    if (task.status !== "succeeded") {
      return task;
    }

    const { assets } = await this.dependencies.finalizeImageGenerationService.finalizeCompletedTask(task);
    return {
      ...task,
      data: {
        ...(typeof task.data === "object" && task.data !== null ? (task.data as Record<string, unknown>) : {}),
        assets,
      },
    };
  }

  public async cancelImageGeneration(requestId: string, _context?: ApplicationRequestContext): Promise<CancelRuntimeTaskResult> {
    return this.dependencies.runtimeTaskRegistry.cancelTask(requestId);
  }
}
