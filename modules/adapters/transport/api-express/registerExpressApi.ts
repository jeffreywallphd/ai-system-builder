import {
  API_IMAGE_UPLOAD_OPERATION,
  createApiImageUploadRequest,
  createApiImageUploadSuccessResponse,
  createApiError,
  createApiFailureResponse,
  type ApiImageUploadResponse,
} from "../../../contracts/api";
import type {
  StoreImageUploadCommand,
  StoreImageUploadCommandContext,
  StoreImageUploadUseCaseResult,
} from "../../../application/use-cases";

export interface StoreImageUploadUseCasePort {
  execute: (
    command: StoreImageUploadCommand,
    commandContext: StoreImageUploadCommandContext,
    context?: {
      requestId?: string;
      correlationId?: string;
    },
  ) => Promise<StoreImageUploadUseCaseResult>;
}

interface ApiImageUploadRequestBody {
  fileName: string;
  mediaType: string;
  bytes: number[];
  source: string;
}

interface ExpressRequestLike {
  body: ApiImageUploadRequestBody;
  headers?: Record<string, string | string[] | undefined>;
}

interface ExpressResponseLike {
  status: (statusCode: number) => ExpressResponseLike;
  json: (body: ApiImageUploadResponse) => void;
}

export interface ExpressPostRoutePort {
  post: (
    path: string,
    handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>,
  ) => void;
}

function getRequestHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = headers?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function mapApiImageUploadRequestToCommand(requestBody: ApiImageUploadRequestBody): StoreImageUploadCommand {
  return {
    fileName: requestBody.fileName,
    mediaType: requestBody.mediaType,
    bytes: new Uint8Array(requestBody.bytes),
  };
}

function mapApiImageUploadRequestToContext(
  requestBody: ApiImageUploadRequestBody,
): StoreImageUploadCommandContext {
  return {
    host: "server",
    source: requestBody.source,
  };
}

export function mapStoreImageUploadResultToApiResponse(
  result: StoreImageUploadUseCaseResult,
  context: {
    requestId?: string;
    correlationId?: string;
  },
): ApiImageUploadResponse {
  if (result.ok) {
    return createApiImageUploadSuccessResponse(result.value.descriptor, {
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    });
  }

  return createApiFailureResponse(
    createApiError(
      API_IMAGE_UPLOAD_OPERATION,
      result.error.code,
      result.error.message,
      {
        details: result.error.details,
        requestId: result.requestId ?? context.requestId,
        correlationId: result.correlationId ?? context.correlationId,
      },
    ),
    {
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    },
  );
}

function resolveStatusCode(response: ApiImageUploadResponse): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error.kind) {
    case "client":
      return 400;
    case "transient":
      return 503;
    default:
      return 500;
  }
}

export function registerExpressApi(dependencies: {
  app: ExpressPostRoutePort;
  storeImageUploadUseCase: StoreImageUploadUseCasePort;
}): void {
  dependencies.app.post("/api/image/upload", async (request, response) => {
    const requestId = getRequestHeader(request.headers, "x-request-id");
    const correlationId = getRequestHeader(request.headers, "x-correlation-id");
    const apiRequest = createApiImageUploadRequest(
      {
        fileName: request.body.fileName,
        mediaType: request.body.mediaType,
        bytes: new Uint8Array(request.body.bytes),
        boundary: {
          host: "server",
          source: request.body.source,
        },
      },
      {
        requestId,
        correlationId,
      },
    );

    const result = await dependencies.storeImageUploadUseCase.execute(
      mapApiImageUploadRequestToCommand(request.body),
      mapApiImageUploadRequestToContext(request.body),
      {
        requestId: apiRequest.requestId,
        correlationId: apiRequest.correlationId,
      },
    );

    const apiResponse = mapStoreImageUploadResultToApiResponse(result, {
      requestId: apiRequest.requestId,
      correlationId: apiRequest.correlationId,
    });

    response.status(resolveStatusCode(apiResponse)).json(apiResponse);
  });
}
