import type { ImageGenerationRequest } from "../../../../contracts/image-generation";
import { createApiError, createApiFailureResponse, createApiSuccessResponse } from "../../../../contracts/api";
import type { GenerateImageUseCase } from "../../../../application/use-cases/image-generation/generate-image.use-case";
import type { ImageGenerationFinalizationOrchestratorService } from "../../../../application/services/image/image-generation-finalization-orchestrator.service";

const API_IMAGE_GENERATION_START_OPERATION = "image-generation.start" as const;
const API_IMAGE_GENERATION_READ_OPERATION = "image-generation.read" as const;
const API_IMAGE_GENERATION_CANCEL_OPERATION = "image-generation.cancel" as const;
const API_IMAGE_GENERATION_FINALIZE_OPERATION = "image-generation.finalize-if-completed" as const;

interface ExpressRequestLike { body?: unknown; headers?: Record<string, string | string[] | undefined>; }
interface ExpressResponseLike { status: (code: number) => ExpressResponseLike; json: (body: unknown) => void; }
export interface ExpressRoutePort { post: (path: string, handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>) => void; }

export interface RegisterImageGenerationApiRoutesDependencies {
  app: ExpressRoutePort;
  generateImageUseCase: Pick<GenerateImageUseCase, "startImageGeneration" | "readImageGeneration" | "cancelImageGeneration">;
  imageGenerationFinalizationOrchestrator?: Pick<ImageGenerationFinalizationOrchestratorService, "finalizeIfCompleted">;
}

const getHeader = (h: ExpressRequestLike["headers"], k: string) => Array.isArray(h?.[k]) ? h?.[k][0] : h?.[k];
const contextFrom = (r: ExpressRequestLike) => ({ requestId: getHeader(r.headers, "x-request-id"), correlationId: getHeader(r.headers, "x-correlation-id") });
const failure = (operation: `${Lowercase<string>}.${Lowercase<string>}`, error: unknown, context: { requestId?: string; correlationId?: string }) => createApiFailureResponse(createApiError(operation, "internal", error instanceof Error ? error.message : "Unexpected error.", context), context);
const statusCode = (response: { ok: boolean }) => (response.ok ? 200 : 500);

export function registerImageGenerationApiRoutes(dependencies: RegisterImageGenerationApiRoutesDependencies): void {
  dependencies.app.post("/api/image-generation/start", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.generateImageUseCase.startImageGeneration(request.body as ImageGenerationRequest, context);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_START_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const apiResponse = failure(API_IMAGE_GENERATION_START_OPERATION, error, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/read", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.generateImageUseCase.readImageGeneration((request.body as { requestId: string }).requestId, context);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_READ_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const apiResponse = failure(API_IMAGE_GENERATION_READ_OPERATION, error, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/cancel", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.generateImageUseCase.cancelImageGeneration((request.body as { requestId: string }).requestId, context);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_CANCEL_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const apiResponse = failure(API_IMAGE_GENERATION_CANCEL_OPERATION, error, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/finalize", async (request, response) => {
    const context = contextFrom(request);
    if (!dependencies.imageGenerationFinalizationOrchestrator) {
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_FINALIZE_OPERATION, { finalized: false, reason: "image generation finalization is unavailable" }, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
      return;
    }

    try {
      const value = await dependencies.imageGenerationFinalizationOrchestrator.finalizeIfCompleted((request.body as { requestId: string }).requestId);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_FINALIZE_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const apiResponse = failure(API_IMAGE_GENERATION_FINALIZE_OPERATION, error, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });
}
