import type { ImageGenerationRequest } from "../../../../contracts/image-generation";
import { createApiError, createApiFailureResponse, createApiSuccessResponse } from "../../../../contracts/api";
import type { GenerateImageUseCase } from "../../../../application/use-cases/image-generation/generate-image.use-case";
import type { ImageGenerationFinalizationOrchestratorService } from "../../../../application/services/image/image-generation-finalization-orchestrator.service";

const API_IMAGE_GENERATION_START_OPERATION = "image-generation.start" as const;
const API_IMAGE_GENERATION_READ_OPERATION = "image-generation.read" as const;
const API_IMAGE_GENERATION_CANCEL_OPERATION = "image-generation.cancel" as const;
const API_IMAGE_GENERATION_FINALIZE_OPERATION = "image-generation.finalize-if-completed" as const;
const API_IMAGE_GENERATION_UNLOAD_MODEL_OPERATION = "image-generation.unload-model" as const;
const API_IMAGE_GENERATION_RUNTIME_RESOURCES_OPERATION = "image-generation.runtime-resources" as const;

type ImageGenerationOperation = typeof API_IMAGE_GENERATION_START_OPERATION | typeof API_IMAGE_GENERATION_READ_OPERATION | typeof API_IMAGE_GENERATION_CANCEL_OPERATION | typeof API_IMAGE_GENERATION_FINALIZE_OPERATION | typeof API_IMAGE_GENERATION_UNLOAD_MODEL_OPERATION | typeof API_IMAGE_GENERATION_RUNTIME_RESOURCES_OPERATION;

interface ExpressRequestLike { body?: unknown; headers?: Record<string, string | string[] | undefined>; }
interface ExpressResponseLike { status: (code: number) => ExpressResponseLike; json: (body: unknown) => void; }
export interface ExpressRoutePort { post: (path: string, handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>) => void; get?: (path: string, handler: (request: any, response: any) => Promise<void>) => void; }

export interface RegisterImageGenerationApiRoutesDependencies {
  app: ExpressRoutePort;
  generateImageUseCase: Pick<GenerateImageUseCase, "startImageGeneration" | "readImageGeneration" | "cancelImageGeneration">;
  imageGenerationFinalizationOrchestrator?: Pick<ImageGenerationFinalizationOrchestratorService, "finalizeIfCompleted">;
  imageGenerationRuntimeControl?: {
    unloadModel: () => Promise<{ unloaded: boolean; message?: string }>;
    readRuntimeResources?: () => Promise<{ memoryUsagePercent: number; cpuUsagePercent: number; gpuUsagePercent: number }>;
    readOutputPreview?: (input: { fileName: string; subfolder?: string }) => Promise<{ mediaType: string; contentBase64: string }>;
  };
}

const getHeader = (h: ExpressRequestLike["headers"], k: string) => Array.isArray(h?.[k]) ? h?.[k][0] : h?.[k];
const contextFrom = (r: ExpressRequestLike) => ({ requestId: getHeader(r.headers, "x-request-id"), correlationId: getHeader(r.headers, "x-correlation-id") });

const isObjectRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function mapStartBody(body: unknown): ImageGenerationRequest {
  if (!isObjectRecord(body)) throw new Error("Request body must be an object.");
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw new Error("prompt is required.");
  return { ...body, prompt } as ImageGenerationRequest;
}

function mapRequestIdBody(body: unknown): string {
  if (!isObjectRecord(body)) throw new Error("Request body must be an object.");
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  if (!requestId) throw new Error("requestId is required.");
  return requestId;
}

function failure(operation: ImageGenerationOperation, code: "internal" | "validation" | "not-found" | "unavailable", message: string, context: { requestId?: string; correlationId?: string }) {
  return createApiFailureResponse(createApiError(operation, code, message, context), context);
}

function statusCode(response: { ok: boolean; error?: { code: string } }): number {
  if (response.ok) return 200;
  switch (response.error?.code) {
    case "validation": return 400;
    case "not-found": return 404;
    case "unavailable": return 503;
    default: return 500;
  }
}

function mapFailureCode(error: unknown): "internal" | "validation" | "not-found" | "unavailable" {
  if (error instanceof Error && (error.message.includes("required") || error.message.includes("body"))) return "validation";
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "validation" || code === "not-found" || code === "unavailable") return code;
  }
  return "internal";
}

export function registerImageGenerationApiRoutes(dependencies: RegisterImageGenerationApiRoutesDependencies): void {
  dependencies.app.post("/api/image-generation/start", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.generateImageUseCase.startImageGeneration(mapStartBody(request.body), context);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_START_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const apiResponse = failure(API_IMAGE_GENERATION_START_OPERATION, mapFailureCode(error), message, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/read", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.generateImageUseCase.readImageGeneration(mapRequestIdBody(request.body), context);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_READ_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const apiResponse = failure(API_IMAGE_GENERATION_READ_OPERATION, mapFailureCode(error), message, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/cancel", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.generateImageUseCase.cancelImageGeneration(mapRequestIdBody(request.body), context);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_CANCEL_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const apiResponse = failure(API_IMAGE_GENERATION_CANCEL_OPERATION, mapFailureCode(error), message, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/finalize", async (request, response) => {
    const context = contextFrom(request);
    try {
      const requestId = mapRequestIdBody(request.body);
      if (!dependencies.imageGenerationFinalizationOrchestrator) {
        const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_FINALIZE_OPERATION, { finalized: false, reason: "image generation finalization is unavailable" }, context);
        response.status(statusCode(apiResponse)).json(apiResponse);
        return;
      }

      const value = await dependencies.imageGenerationFinalizationOrchestrator.finalizeIfCompleted(requestId);
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_FINALIZE_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const apiResponse = failure(API_IMAGE_GENERATION_FINALIZE_OPERATION, mapFailureCode(error), message, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });

  dependencies.app.post("/api/image-generation/unload-model", async (request, response) => {
    const context = contextFrom(request);
    try {
      if (!dependencies.imageGenerationRuntimeControl) {
        const apiResponse = failure(API_IMAGE_GENERATION_UNLOAD_MODEL_OPERATION, "unavailable", "Image generation runtime control is unavailable.", context);
        response.status(statusCode(apiResponse)).json(apiResponse);
        return;
      }
      const value = await dependencies.imageGenerationRuntimeControl.unloadModel();
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_UNLOAD_MODEL_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const apiResponse = failure(API_IMAGE_GENERATION_UNLOAD_MODEL_OPERATION, mapFailureCode(error), message, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });


  dependencies.app.get?.("/api/image-generation/output-preview", async (request: any, response: any) => {
    try {
      const fileName = typeof request?.query?.fileName === "string" ? request.query.fileName.trim() : "";
      const subfolder = typeof request?.query?.subfolder === "string" ? request.query.subfolder.trim() : undefined;
      if (!fileName || !dependencies.imageGenerationRuntimeControl?.readOutputPreview) {
        response.status(404).end();
        return;
      }
      const preview = await dependencies.imageGenerationRuntimeControl.readOutputPreview({ fileName, subfolder });
      response.setHeader("content-type", preview.mediaType);
      response.status(200).send(Buffer.from(preview.contentBase64, "base64"));
    } catch {
      response.status(404).end();
    }
  });

  dependencies.app.post("/api/image-generation/runtime-resources", async (request, response) => {
    const context = contextFrom(request);
    try {
      const value = await dependencies.imageGenerationRuntimeControl?.readRuntimeResources?.() ?? { memoryUsagePercent: 0, cpuUsagePercent: 0, gpuUsagePercent: 0 };
      const apiResponse = createApiSuccessResponse(API_IMAGE_GENERATION_RUNTIME_RESOURCES_OPERATION, value, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error.";
      const apiResponse = failure(API_IMAGE_GENERATION_RUNTIME_RESOURCES_OPERATION, mapFailureCode(error), message, context);
      response.status(statusCode(apiResponse)).json(apiResponse);
    }
  });
}


