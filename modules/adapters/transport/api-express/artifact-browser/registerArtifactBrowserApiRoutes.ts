import {
  createApiArtifactBrowseFailureResponse,
  createApiArtifactBrowseRequest,
  createApiArtifactBrowseSuccessResponse,
  createApiArtifactContentReadFailureResponse,
  createApiArtifactContentReadRequest,
  createApiArtifactContentReadSuccessResponse,
  createApiArtifactReadFailureResponse,
  createApiArtifactReadRequest,
  createApiArtifactReadSuccessResponse,
  type ApiArtifactBrowseResponse,
  type ApiArtifactContentReadResponse,
  type ApiArtifactReadResponse,
} from "../../../../contracts/api";
import type {
  BrowseArtifactsCommand,
  BrowseArtifactsUseCaseResult,
  ReadArtifactContentCommand,
  ReadArtifactContentUseCaseResult,
  ReadArtifactDetailCommand,
  ReadArtifactDetailUseCaseResult,
} from "../../../../application/use-cases";

export interface ArtifactBrowserUseCasePort {
  browseArtifacts: {
    execute: (
      command: BrowseArtifactsCommand,
      context?: { requestId?: string; correlationId?: string },
    ) => Promise<BrowseArtifactsUseCaseResult>;
  };
  readArtifactDetail: {
    execute: (
      command: ReadArtifactDetailCommand,
      context?: { requestId?: string; correlationId?: string },
    ) => Promise<ReadArtifactDetailUseCaseResult>;
  };
  readArtifactContent: {
    execute: (
      command: ReadArtifactContentCommand,
      context?: { requestId?: string; correlationId?: string },
    ) => Promise<ReadArtifactContentUseCaseResult>;
  };
}

interface ArtifactBrowseApiRequestBody {
  artifactKind: "image";
  source?: string;
}

interface ArtifactReadApiRequestBody {
  locator: { storageKey: string };
  source?: string;
}

export interface ExpressRequestLike {
  body?: ArtifactBrowseApiRequestBody | ArtifactReadApiRequestBody;
  headers?: Record<string, string | string[] | undefined>;
}

export interface ExpressResponseLike {
  status: (statusCode: number) => ExpressResponseLike;
  json: (
    body: ApiArtifactBrowseResponse | ApiArtifactReadResponse | ApiArtifactContentReadResponse,
  ) => void;
}

export interface ExpressPostRoutePort {
  post: (
    path: string,
    handler: (request: ExpressRequestLike, response: ExpressResponseLike) => Promise<void>,
  ) => void;
}

export interface RegisterArtifactBrowserApiRoutesDependencies {
  app: ExpressPostRoutePort;
  useCases: ArtifactBrowserUseCasePort;
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

function normalizeSource(value: string | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0
    ? normalized
    : "thin-client.artifact-browser";
}

function resolveStatusCode(
  response: ApiArtifactBrowseResponse | ApiArtifactReadResponse | ApiArtifactContentReadResponse,
): number {
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

export function registerArtifactBrowserApiRoutes(
  dependencies: RegisterArtifactBrowserApiRoutesDependencies,
): void {
  dependencies.app.post("/api/artifact/browse", async (request, response) => {
    const requestId = getRequestHeader(request.headers, "x-request-id");
    const correlationId = getRequestHeader(request.headers, "x-correlation-id");

    let browseCommand: BrowseArtifactsCommand;
    try {
      const apiRequest = createApiArtifactBrowseRequest(
        {
          artifactKind: (request.body as ArtifactBrowseApiRequestBody)?.artifactKind,
          boundary: {
            host: "server",
            source: normalizeSource((request.body as ArtifactBrowseApiRequestBody)?.source),
          },
        },
        { requestId, correlationId },
      );
      browseCommand = { artifactKind: apiRequest.payload.artifactKind };
    } catch (error) {
      const apiResponse = createApiArtifactBrowseFailureResponse(
        "validation",
        error instanceof Error ? error.message : "Invalid artifact browse request.",
        { requestId, correlationId },
      );
      response.status(resolveStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.useCases.browseArtifacts.execute(browseCommand, {
      requestId,
      correlationId,
    });

    const apiResponse = result.ok
      ? createApiArtifactBrowseSuccessResponse(result.value, {
        requestId: result.requestId ?? requestId,
        correlationId: result.correlationId ?? correlationId,
      })
      : createApiArtifactBrowseFailureResponse(
        result.error.code === "validation" || result.error.code === "unavailable"
          ? result.error.code
          : "internal",
        result.error.message,
        {
          details: result.error.details,
          requestId: result.requestId ?? requestId,
          correlationId: result.correlationId ?? correlationId,
        },
      );

    response.status(resolveStatusCode(apiResponse)).json(apiResponse);
  });

  dependencies.app.post("/api/artifact/read", async (request, response) => {
    const requestId = getRequestHeader(request.headers, "x-request-id");
    const correlationId = getRequestHeader(request.headers, "x-correlation-id");

    let detailCommand: ReadArtifactDetailCommand;
    try {
      const apiRequest = createApiArtifactReadRequest(
        {
          locator: (request.body as ArtifactReadApiRequestBody)?.locator,
          boundary: {
            host: "server",
            source: normalizeSource((request.body as ArtifactReadApiRequestBody)?.source),
          },
        },
        { requestId, correlationId },
      );
      detailCommand = { locator: apiRequest.payload.locator };
    } catch (error) {
      const apiResponse = createApiArtifactReadFailureResponse(
        "validation",
        error instanceof Error ? error.message : "Invalid artifact read request.",
        { requestId, correlationId },
      );
      response.status(resolveStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.useCases.readArtifactDetail.execute(detailCommand, {
      requestId,
      correlationId,
    });

    const apiResponse = result.ok
      ? createApiArtifactReadSuccessResponse(result.value, {
        requestId: result.requestId ?? requestId,
        correlationId: result.correlationId ?? correlationId,
      })
      : createApiArtifactReadFailureResponse(
        result.error.code === "validation" || result.error.code === "not-found" || result.error.code === "unavailable"
          ? result.error.code
          : "internal",
        result.error.message,
        {
          details: result.error.details,
          requestId: result.requestId ?? requestId,
          correlationId: result.correlationId ?? correlationId,
        },
      );

    response.status(resolveStatusCode(apiResponse)).json(apiResponse);
  });

  dependencies.app.post("/api/artifact/content/read", async (request, response) => {
    const requestId = getRequestHeader(request.headers, "x-request-id");
    const correlationId = getRequestHeader(request.headers, "x-correlation-id");

    let contentCommand: ReadArtifactContentCommand;
    try {
      const apiRequest = createApiArtifactContentReadRequest(
        {
          locator: (request.body as ArtifactReadApiRequestBody)?.locator,
          boundary: {
            host: "server",
            source: normalizeSource((request.body as ArtifactReadApiRequestBody)?.source),
          },
        },
        { requestId, correlationId },
      );
      contentCommand = { locator: apiRequest.payload.locator };
    } catch (error) {
      const apiResponse = createApiArtifactContentReadFailureResponse(
        "validation",
        error instanceof Error ? error.message : "Invalid artifact content-read request.",
        { requestId, correlationId },
      );
      response.status(resolveStatusCode(apiResponse)).json(apiResponse);
      return;
    }

    const result = await dependencies.useCases.readArtifactContent.execute(contentCommand, {
      requestId,
      correlationId,
    });

    const apiResponse = result.ok
      ? createApiArtifactContentReadSuccessResponse(result.value, {
        requestId: result.requestId ?? requestId,
        correlationId: result.correlationId ?? correlationId,
      })
      : createApiArtifactContentReadFailureResponse(
        result.error.code === "validation" || result.error.code === "not-found" || result.error.code === "unavailable"
          ? result.error.code
          : "internal",
        result.error.message,
        {
          details: result.error.details,
          requestId: result.requestId ?? requestId,
          correlationId: result.correlationId ?? correlationId,
        },
      );

    response.status(resolveStatusCode(apiResponse)).json(apiResponse);
  });
}
