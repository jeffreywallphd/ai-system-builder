import type {
  HasArtifactInRepoCommand,
  HasArtifactInRepoUseCasePort,
  PublishArtifactToRepoUseCase,
  StoreArtifactInRepoCommand,
  StoreArtifactInRepoUseCasePort,
} from "../../../../application/use-cases";
import {
  createApiArtifactPublishFailureResponse,
  createApiArtifactPublishRequest,
  createApiArtifactPublishSuccessResponse,
  createApiArtifactRepoHasFailureResponse,
  createApiArtifactRepoHasRequest,
  createApiArtifactRepoHasSuccessResponse,
  createApiArtifactRepoStoreFailureResponse,
  createApiArtifactRepoStoreRequest,
  createApiArtifactRepoStoreSuccessResponse,
  type ApiArtifactPublishResponse,
  type ApiArtifactRepoHasResponse,
  type ApiArtifactRepoStoreResponse,
} from "../../../../contracts/api";

interface ArtifactRepoHasApiRequestBody {
  target: {
    provider: string;
    repository: string;
    revision?: string;
    path?: string;
  };
  source?: string;
}

interface ArtifactRepoStoreApiRequestBody extends ArtifactRepoHasApiRequestBody {
  contentBase64: string;
  mediaType?: string;
  overwrite?: boolean;
}

interface ArtifactPublishApiRequestBody {
  artifactId: string;
  target: {
    provider: string;
    repository: string;
    revision?: string;
    path?: string;
  };
  mediaType?: string;
  verify?: boolean;
  source?: string;
}

export interface ArtifactRepoExpressRequestLike {
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ArtifactRepoExpressResponseLike {
  status: (statusCode: number) => ArtifactRepoExpressResponseLike;
  json: (body: ApiArtifactRepoHasResponse | ApiArtifactRepoStoreResponse | ApiArtifactPublishResponse) => void;
}

export interface ArtifactRepoExpressRoutePort {
  post: (
    path: string,
    handler: (
      request: ArtifactRepoExpressRequestLike,
      response: ArtifactRepoExpressResponseLike,
    ) => Promise<void>,
  ) => void;
}

export interface RegisterArtifactRepoApiRoutesDependencies {
  app: ArtifactRepoExpressRoutePort;
  hasArtifactInRepoUseCase: HasArtifactInRepoUseCasePort;
  storeArtifactInRepoUseCase: StoreArtifactInRepoUseCasePort;
  publishArtifactToRepoUseCase: Pick<PublishArtifactToRepoUseCase, "execute">;
}

function getRequestHeader(
  headers: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = headers?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSource(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "thin-client.artifact-repo";
}

function mapRequestContext(
  request: ArtifactRepoExpressRequestLike,
): { requestId?: string; correlationId?: string } {
  return {
    requestId: getRequestHeader(request.headers, "x-request-id"),
    correlationId: getRequestHeader(request.headers, "x-correlation-id"),
  };
}

function mapApiHasRequestToCommand(
  requestBody: ArtifactRepoHasApiRequestBody,
  context: { requestId?: string; correlationId?: string },
): HasArtifactInRepoCommand {
  const apiRequest = createApiArtifactRepoHasRequest(
    {
      target: requestBody.target,
      boundary: {
        host: "server",
        source: normalizeSource(requestBody.source),
      },
    },
    context,
  );

  return {
    target: apiRequest.payload.target,
  };
}

function mapApiStoreRequestToCommand(
  requestBody: ArtifactRepoStoreApiRequestBody,
  context: { requestId?: string; correlationId?: string },
): StoreArtifactInRepoCommand {
  const apiRequest = createApiArtifactRepoStoreRequest(
    {
      target: requestBody.target,
      contentBase64: requestBody.contentBase64,
      mediaType: requestBody.mediaType,
      overwrite: requestBody.overwrite,
      boundary: {
        host: "server",
        source: normalizeSource(requestBody.source),
      },
    },
    context,
  );

  return {
    target: apiRequest.payload.target,
    content: new Uint8Array(Buffer.from(apiRequest.payload.contentBase64, "base64")),
    mediaType: apiRequest.payload.mediaType,
    overwrite: apiRequest.payload.overwrite,
  };
}

function mapStatusCode(response: ApiArtifactRepoHasResponse | ApiArtifactRepoStoreResponse): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error.code) {
    case "validation":
      return 400;
    case "not-found":
      return 404;
    case "unavailable":
      return 503;
    default:
      return 500;
  }
}

function mapPublishStatusCode(response: ApiArtifactPublishResponse): number {
  if (response.ok) {
    return 200;
  }

  switch (response.error.code) {
    case "validation":
      return 400;
    case "not-found":
      return 404;
    case "unavailable":
      return 503;
    default:
      return 500;
  }
}

function mapHasResultToApiResponse(
  result: Awaited<ReturnType<HasArtifactInRepoUseCasePort["execute"]>>,
  context: { requestId?: string; correlationId?: string },
): ApiArtifactRepoHasResponse {
  if (result.ok) {
    return createApiArtifactRepoHasSuccessResponse(result.value, {
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    });
  }

  return createApiArtifactRepoHasFailureResponse(
    result.error.code === "validation" || result.error.code === "not-found" || result.error.code === "unavailable"
      ? result.error.code
      : "internal",
    result.error.message,
    {
      details: result.error.details,
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    },
  );
}

function mapStoreResultToApiResponse(
  result: Awaited<ReturnType<StoreArtifactInRepoUseCasePort["execute"]>>,
  context: { requestId?: string; correlationId?: string },
): ApiArtifactRepoStoreResponse {
  if (result.ok) {
    return createApiArtifactRepoStoreSuccessResponse(result.value, {
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    });
  }

  return createApiArtifactRepoStoreFailureResponse(
    result.error.code === "validation" || result.error.code === "not-found" || result.error.code === "unavailable"
      ? result.error.code
      : "internal",
    result.error.message,
    {
      details: result.error.details,
      requestId: result.requestId ?? context.requestId,
      correlationId: result.correlationId ?? context.correlationId,
    },
  );
}

export function registerArtifactRepoApiRoutes(
  dependencies: RegisterArtifactRepoApiRoutesDependencies,
): void {
  dependencies.app.post("/api/artifact-repo/has", async (request, response) => {
    const context = mapRequestContext(request);
    let command: HasArtifactInRepoCommand;

    try {
      command = mapApiHasRequestToCommand(request.body as ArtifactRepoHasApiRequestBody, context);
    } catch (error) {
      const apiResponse = createApiArtifactRepoHasFailureResponse(
        "validation",
        error instanceof Error ? error.message : "Invalid artifact-repo has request.",
        context,
      );
      response.status(mapStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.hasArtifactInRepoUseCase.execute(command, context);
    const apiResponse = mapHasResultToApiResponse(result, context);
    response.status(mapStatusCode(apiResponse)).json(apiResponse);
  });

  dependencies.app.post("/api/artifact-repo/store", async (request, response) => {
    const context = mapRequestContext(request);
    let command: StoreArtifactInRepoCommand;

    try {
      command = mapApiStoreRequestToCommand(request.body as ArtifactRepoStoreApiRequestBody, context);
    } catch (error) {
      const apiResponse = createApiArtifactRepoStoreFailureResponse(
        "validation",
        error instanceof Error ? error.message : "Invalid artifact-repo store request.",
        context,
      );
      response.status(mapStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.storeArtifactInRepoUseCase.execute(command, context);
    const apiResponse = mapStoreResultToApiResponse(result, context);
    response.status(mapStatusCode(apiResponse)).json(apiResponse);
  });

  dependencies.app.post("/api/artifact/publish", async (request, response) => {
    const context = mapRequestContext(request);
    let apiRequest: ReturnType<typeof createApiArtifactPublishRequest>;

    try {
      apiRequest = createApiArtifactPublishRequest({
        artifactId: (request.body as ArtifactPublishApiRequestBody).artifactId,
        target: {
          provider: (request.body as ArtifactPublishApiRequestBody).target?.provider ?? "",
          repository: (request.body as ArtifactPublishApiRequestBody).target?.repository ?? "",
          revision: (request.body as ArtifactPublishApiRequestBody).target?.revision,
          path: (request.body as ArtifactPublishApiRequestBody).target?.path ?? "",
        },
        mediaType: (request.body as ArtifactPublishApiRequestBody).mediaType,
        verify: (request.body as ArtifactPublishApiRequestBody).verify,
        source: normalizeSource((request.body as ArtifactPublishApiRequestBody).source),
      }, context);
    } catch (error) {
      const apiResponse = createApiArtifactPublishFailureResponse(
        "validation",
        error instanceof Error ? error.message : "Invalid artifact publish request.",
        context,
      );
      response.status(mapPublishStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.publishArtifactToRepoUseCase.execute({
      artifactId: apiRequest.payload.artifactId,
      target: apiRequest.payload.target,
      mediaType: apiRequest.payload.mediaType,
    });

    const apiResponse = result.ok
      ? createApiArtifactPublishSuccessResponse(result.value, context)
      : createApiArtifactPublishFailureResponse(
        result.error.code === "validation" || result.error.code === "not-found" || result.error.code === "unavailable"
          ? result.error.code
          : "internal",
        result.error.message,
        {
          details: result.error.details,
          requestId: context.requestId,
          correlationId: context.correlationId,
        },
      );
    response.status(mapPublishStatusCode(apiResponse)).json(apiResponse);
  });
}
