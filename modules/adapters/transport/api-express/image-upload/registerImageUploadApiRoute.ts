import {
  API_IMAGE_UPLOAD_OPERATION,
  createApiImageUploadSuccessResponse,
  createApiError,
  createApiFailureResponse,
  type ApiImageUploadResponse,
} from "../../../../contracts/api";
import type {
  StoreImageUploadCommand,
  StoreImageUploadCommandContext,
  StoreImageUploadUseCaseResult,
} from "../../../../application/use-cases";

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

export interface ApiImageUploadRequestBody {
  fileName: string;
  mediaType: string;
  bytes: number[];
  source: string;
}

export interface ExpressRequestLike {
  body: ApiImageUploadRequestBody;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ExpressResponseLike {
  status: (statusCode: number) => ExpressResponseLike;
  json: (body: ApiImageUploadResponse) => void;
}

export interface ExpressPostRoutePort {
  post: (
    path: string,
    handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>,
  ) => void;
}

export interface RegisterImageUploadApiRouteDependencies {
  app: ExpressPostRoutePort;
  storeImageUploadUseCase: StoreImageUploadUseCasePort;
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

export function mapApiImageUploadRequestBody(
  requestBody: ApiImageUploadRequestBody,
): {
  command: StoreImageUploadCommand;
  commandContext: StoreImageUploadCommandContext;
} {
  return {
    command: {
      fileName: requestBody.fileName,
      mediaType: requestBody.mediaType,
      bytes: new Uint8Array(requestBody.bytes),
    },
    commandContext: {
      source: requestBody.source,
    },
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

export function registerImageUploadApiRoute(
  dependencies: RegisterImageUploadApiRouteDependencies,
): void {
  dependencies.app.post("/api/image/upload", async (request, response) => {
    const requestId = getRequestHeader(request.headers, "x-request-id");
    const correlationId = getRequestHeader(request.headers, "x-correlation-id");
    const mapping = mapApiImageUploadRequestBody(request.body);

    const result = await dependencies.storeImageUploadUseCase.execute(
      mapping.command,
      mapping.commandContext,
      {
        requestId,
        correlationId,
      },
    );

    const apiResponse = mapStoreImageUploadResultToApiResponse(result, {
      requestId,
      correlationId,
    });

    response.status(resolveStatusCode(apiResponse)).json(apiResponse);
  });
}
