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
  BrowseArtifactsUseCasePort,
  BrowseArtifactsUseCaseResult,
  ReadArtifactContentCommand,
  ReadArtifactContentUseCasePort,
  ReadArtifactContentUseCaseResult,
  ReadArtifactDetailCommand,
  ReadArtifactDetailUseCasePort,
  ReadArtifactDetailUseCaseResult,
} from "../../../../application/use-cases";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";
export type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface RegisterArtifactBrowserIpcDependencies {
  ipcMain: IpcMainHandlePort;
  browseArtifactsUseCase: BrowseArtifactsUseCasePort;
  readArtifactDetailUseCase: ReadArtifactDetailUseCasePort;
  readArtifactContentUseCase: ReadArtifactContentUseCasePort;
}

export function mapDesktopArtifactBrowseRequestToCommand(
  request: DesktopArtifactBrowseRequest,
): BrowseArtifactsCommand {
  return {
    artifactKind: request.payload.artifactKind,
  };
}

export function mapDesktopArtifactReadRequestToCommand(
  request: DesktopArtifactReadRequest,
): ReadArtifactDetailCommand {
  return {
    locator: request.payload.locator,
  };
}

export function mapDesktopArtifactContentReadRequestToCommand(
  request: DesktopArtifactContentReadRequest,
): ReadArtifactContentCommand {
  return {
    locator: request.payload.locator,
  };
}

export function mapDesktopArtifactRequestContext(
  request:
    | DesktopArtifactBrowseRequest
    | DesktopArtifactReadRequest
    | DesktopArtifactContentReadRequest,
): { requestId?: string; correlationId?: string } {
  return {
    requestId: request.requestId,
    correlationId: request.correlationId,
  };
}

function mapBrowseArtifactsFailure(
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

function mapReadArtifactFailure(
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

function mapReadArtifactContentFailure(
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

export function mapBrowseArtifactsResultToDesktopResponse(
  result: BrowseArtifactsUseCaseResult,
  request: DesktopArtifactBrowseRequest,
): DesktopArtifactBrowseResponse {
  if (!result.ok) {
    return mapBrowseArtifactsFailure(request, result.error);
  }

  return createDesktopArtifactBrowseSuccessResponse(result.value, {
    requestId: result.requestId ?? request.requestId,
    correlationId: result.correlationId ?? request.correlationId,
  });
}

export function mapReadArtifactDetailResultToDesktopResponse(
  result: ReadArtifactDetailUseCaseResult,
  request: DesktopArtifactReadRequest,
): DesktopArtifactReadResponse {
  if (!result.ok) {
    return mapReadArtifactFailure(request, result.error);
  }

  return createDesktopArtifactReadSuccessResponse(result.value, {
    requestId: result.requestId ?? request.requestId,
    correlationId: result.correlationId ?? request.correlationId,
  });
}

export function mapReadArtifactContentResultToDesktopResponse(
  result: ReadArtifactContentUseCaseResult,
  request: DesktopArtifactContentReadRequest,
): DesktopArtifactContentReadResponse {
  if (!result.ok) {
    return mapReadArtifactContentFailure(request, result.error);
  }

  return createDesktopArtifactContentReadSuccessResponse(result.value, {
    requestId: result.requestId ?? request.requestId,
    correlationId: result.correlationId ?? request.correlationId,
  });
}

export function createDesktopArtifactBrowseIpcHandler(
  browseArtifactsUseCase: BrowseArtifactsUseCasePort,
) {
  return async (
    _event: unknown,
    request: DesktopArtifactBrowseRequest,
  ): Promise<DesktopArtifactBrowseResponse> => {
    const command = mapDesktopArtifactBrowseRequestToCommand(request);
    const result = await browseArtifactsUseCase.execute(
      command,
      mapDesktopArtifactRequestContext(request),
    );

    return mapBrowseArtifactsResultToDesktopResponse(result, request);
  };
}

export function createDesktopArtifactReadIpcHandler(
  readArtifactDetailUseCase: ReadArtifactDetailUseCasePort,
) {
  return async (
    _event: unknown,
    request: DesktopArtifactReadRequest,
  ): Promise<DesktopArtifactReadResponse> => {
    const command = mapDesktopArtifactReadRequestToCommand(request);
    const result = await readArtifactDetailUseCase.execute(
      command,
      mapDesktopArtifactRequestContext(request),
    );

    return mapReadArtifactDetailResultToDesktopResponse(result, request);
  };
}

export function createDesktopArtifactContentReadIpcHandler(
  readArtifactContentUseCase: ReadArtifactContentUseCasePort,
) {
  return async (
    _event: unknown,
    request: DesktopArtifactContentReadRequest,
  ): Promise<DesktopArtifactContentReadResponse> => {
    const command = mapDesktopArtifactContentReadRequestToCommand(request);
    const result = await readArtifactContentUseCase.execute(
      command,
      mapDesktopArtifactRequestContext(request),
    );

    return mapReadArtifactContentResultToDesktopResponse(result, request);
  };
}

export function registerArtifactBrowserIpc(
  dependencies: RegisterArtifactBrowserIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value,
    createDesktopArtifactBrowseIpcHandler(dependencies.browseArtifactsUseCase),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value,
    createDesktopArtifactReadIpcHandler(dependencies.readArtifactDetailUseCase),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value,
    createDesktopArtifactContentReadIpcHandler(dependencies.readArtifactContentUseCase),
  );
}
