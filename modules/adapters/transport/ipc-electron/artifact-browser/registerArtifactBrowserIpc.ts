import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL,
  createDesktopArtifactBrowseSuccessResponse,
  createDesktopArtifactContentReadSuccessResponse,
  createDesktopArtifactReadSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  type DesktopArtifactBrowseRequest,
  type DesktopArtifactBrowseResponse,
  type DesktopArtifactContentReadRequest,
  type DesktopArtifactContentReadResponse,
  type DesktopArtifactReadRequest,
  type DesktopArtifactReadResponse,
} from "../../../../contracts/ipc";
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

export interface IpcMainHandlePort {
  handle: (
    channel: string,
    listener: (event: unknown, request: unknown) => Promise<unknown>,
  ) => void;
}

export interface RegisterArtifactBrowserIpcDependencies {
  ipcMain: IpcMainHandlePort;
  useCases: ArtifactBrowserUseCasePort;
}

function toBrowseFailure(
  request: DesktopArtifactBrowseRequest,
  error: { code: string; message: string; details?: Record<string, unknown> },
): DesktopArtifactBrowseResponse {
  return createIpcFailureResponse(
    createIpcError(
      DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL,
      error.code === "validation" || error.code === "unavailable" ? error.code : "internal",
      error.message,
      {
        details: error.details,
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    ),
  );
}

function toReadFailure(
  request: DesktopArtifactReadRequest,
  error: { code: string; message: string; details?: Record<string, unknown> },
): DesktopArtifactReadResponse {
  return createIpcFailureResponse(
    createIpcError(
      DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL,
      error.code === "validation" || error.code === "not-found" || error.code === "unavailable"
        ? error.code
        : "internal",
      error.message,
      {
        details: error.details,
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    ),
  );
}

function toContentFailure(
  request: DesktopArtifactContentReadRequest,
  error: { code: string; message: string; details?: Record<string, unknown> },
): DesktopArtifactContentReadResponse {
  return createIpcFailureResponse(
    createIpcError(
      DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL,
      error.code === "validation" || error.code === "not-found" || error.code === "unavailable"
        ? error.code
        : "internal",
      error.message,
      {
        details: error.details,
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    ),
  );
}

export function createDesktopArtifactBrowseIpcHandler(useCases: ArtifactBrowserUseCasePort) {
  return async (
    _event: unknown,
    request: DesktopArtifactBrowseRequest,
  ): Promise<DesktopArtifactBrowseResponse> => {
    const result = await useCases.browseArtifacts.execute(
      { artifactKind: request.payload.artifactKind },
      {
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    );

    if (!result.ok) {
      return toBrowseFailure(request, result.error);
    }

    return createDesktopArtifactBrowseSuccessResponse(result.value, {
      requestId: result.requestId ?? request.requestId,
      correlationId: result.correlationId ?? request.correlationId,
    });
  };
}

export function createDesktopArtifactReadIpcHandler(useCases: ArtifactBrowserUseCasePort) {
  return async (
    _event: unknown,
    request: DesktopArtifactReadRequest,
  ): Promise<DesktopArtifactReadResponse> => {
    const result = await useCases.readArtifactDetail.execute(
      { locator: request.payload.locator },
      {
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    );

    if (!result.ok) {
      return toReadFailure(request, result.error);
    }

    return createDesktopArtifactReadSuccessResponse(result.value, {
      requestId: result.requestId ?? request.requestId,
      correlationId: result.correlationId ?? request.correlationId,
    });
  };
}

export function createDesktopArtifactContentReadIpcHandler(useCases: ArtifactBrowserUseCasePort) {
  return async (
    _event: unknown,
    request: DesktopArtifactContentReadRequest,
  ): Promise<DesktopArtifactContentReadResponse> => {
    const result = await useCases.readArtifactContent.execute(
      { locator: request.payload.locator },
      {
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    );

    if (!result.ok) {
      return toContentFailure(request, result.error);
    }

    return createDesktopArtifactContentReadSuccessResponse(result.value, {
      requestId: result.requestId ?? request.requestId,
      correlationId: result.correlationId ?? request.correlationId,
    });
  };
}

export function registerArtifactBrowserIpc(
  dependencies: RegisterArtifactBrowserIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value,
    createDesktopArtifactBrowseIpcHandler(dependencies.useCases),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value,
    createDesktopArtifactReadIpcHandler(dependencies.useCases),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value,
    createDesktopArtifactContentReadIpcHandler(dependencies.useCases),
  );
}
