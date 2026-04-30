import type { ImageGenerationRequest } from "../../../contracts/image-generation";
import type { CancelRuntimeTaskResult, RuntimeTaskRecord, StartRuntimeTaskResult } from "../../../contracts/runtime";

export interface ImageGenerationRuntimePort {
  startImageGeneration(
    request: ImageGenerationRequest,
    context?: { requestId?: string },
  ): Promise<StartRuntimeTaskResult>;
  readImageGenerationTask(requestId: string): Promise<RuntimeTaskRecord>;
  cancelImageGenerationTask(requestId: string): Promise<CancelRuntimeTaskResult>;
}
