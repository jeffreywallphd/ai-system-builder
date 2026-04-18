import type { ArtifactContentRetrievalPort } from "../../../../application/ports/artifact-content";
import type {
  BrowseArtifactsCommand,
  BrowseArtifactsUseCasePort,
  PublishArtifactToRepoCommand,
  PublishArtifactToRepoUseCase,
  VerifyPublishedArtifactBackingCommand,
  VerifyPublishedArtifactBackingUseCase,
  BrowseArtifactsUseCaseResult,
  ReadArtifactContentCommand,
  ReadArtifactContentUseCasePort,
  ReadArtifactContentUseCaseResult,
  ReadArtifactDetailCommand,
  ReadArtifactDetailUseCasePort,
  ReadArtifactDetailUseCaseResult,
} from "../../../../application/use-cases";
import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_RESPONSE_CHANNEL,
  createDesktopArtifactBrowseSuccessResponse,
  createDesktopArtifactContentReadSuccessResponse,
  createDesktopArtifactMediaViewSuccessResponse,
  createDesktopArtifactReadSuccessResponse,
  createDesktopArtifactPublishSuccessResponse,
  createDesktopArtifactPublishVerifySuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  type DesktopArtifactBrowseRequest,
  type DesktopArtifactBrowseResponse,
  type DesktopArtifactContentReadRequest,
  type DesktopArtifactContentReadResponse,
  type DesktopArtifactMediaViewRequest,
  type DesktopArtifactMediaViewResponse,
  type DesktopArtifactReadRequest,
  type DesktopArtifactReadResponse,
  type DesktopArtifactPublishRequest,
  type DesktopArtifactPublishResponse,
  type DesktopArtifactPublishVerifyRequest,
  type DesktopArtifactPublishVerifyResponse,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";
export type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface RegisterArtifactBrowserIpcDependencies {
  ipcMain: IpcMainHandlePort;
  browseArtifactsUseCase: BrowseArtifactsUseCasePort;
  readArtifactDetailUseCase: ReadArtifactDetailUseCasePort;
  readArtifactContentUseCase: ReadArtifactContentUseCasePort;
  artifactMediaViewRetrieval: ArtifactContentRetrievalPort;
  publishArtifactToRepoUseCase: Pick<PublishArtifactToRepoUseCase, "execute">;
  verifyPublishedArtifactBackingUseCase: Pick<VerifyPublishedArtifactBackingUseCase, "execute">;
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

export function mapDesktopArtifactMediaViewRequest(
  request: DesktopArtifactMediaViewRequest,
): { storageKey: string } {
  return {
    storageKey: request.payload.storageKey,
  };
}

export function mapDesktopArtifactPublishRequestToCommand(
  request: DesktopArtifactPublishRequest,
): PublishArtifactToRepoCommand {
  return {
    artifactId: request.payload.artifactId,
    target: request.payload.target,
    mediaType: request.payload.mediaType,
  };
}

export function mapDesktopArtifactPublishVerifyRequestToCommand(
  request: DesktopArtifactPublishVerifyRequest,
): VerifyPublishedArtifactBackingCommand {
  return {
    artifactId: request.payload.artifactId,
  };
}

export function mapDesktopArtifactRequestContext(
  request:
    | DesktopArtifactBrowseRequest
    | DesktopArtifactReadRequest
    | DesktopArtifactContentReadRequest
    | DesktopArtifactMediaViewRequest
    | DesktopArtifactPublishRequest
    | DesktopArtifactPublishVerifyRequest,
): { requestId?: string; correlationId?: string } {
  return {
    requestId: request.requestId,
    correlationId: request.correlationId,
  };
}

function mapIpcFailure(
  channel: typeof DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL
    | typeof DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL
    | typeof DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL
    | typeof DESKTOP_ARTIFACT_MEDIA_VIEW_RESPONSE_CHANNEL
    | typeof DESKTOP_ARTIFACT_PUBLISH_RESPONSE_CHANNEL
    | typeof DESKTOP_ARTIFACT_PUBLISH_VERIFY_RESPONSE_CHANNEL,
  request: { requestId?: string; correlationId?: string },
  error: { code: string; message: string; details?: Record<string, unknown> },
) {
  return createIpcFailureResponse(
    createIpcError(
      channel,
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
    return mapIpcFailure(DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL, request, result.error);
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
    return mapIpcFailure(DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL, request, result.error);
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
    return mapIpcFailure(DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL, request, result.error);
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
    const result = await browseArtifactsUseCase.execute(
      mapDesktopArtifactBrowseRequestToCommand(request),
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
    const result = await readArtifactDetailUseCase.execute(
      mapDesktopArtifactReadRequestToCommand(request),
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
    const result = await readArtifactContentUseCase.execute(
      mapDesktopArtifactContentReadRequestToCommand(request),
      mapDesktopArtifactRequestContext(request),
    );

    return mapReadArtifactContentResultToDesktopResponse(result, request);
  };
}

export function createDesktopArtifactMediaViewIpcHandler(
  artifactMediaViewRetrieval: ArtifactContentRetrievalPort,
) {
  return async (
    _event: unknown,
    request: DesktopArtifactMediaViewRequest,
  ): Promise<DesktopArtifactMediaViewResponse> => {
    const retrievalResult = await artifactMediaViewRetrieval.retrieveArtifactViewerMediaByStorageKey(
      mapDesktopArtifactMediaViewRequest(request),
      mapDesktopArtifactRequestContext(request),
    );

    if (!retrievalResult.ok) {
      return mapIpcFailure(DESKTOP_ARTIFACT_MEDIA_VIEW_RESPONSE_CHANNEL, request, retrievalResult.error);
    }

    return createDesktopArtifactMediaViewSuccessResponse(retrievalResult.value, {
      requestId: retrievalResult.requestId ?? request.requestId,
      correlationId: retrievalResult.correlationId ?? request.correlationId,
    });
  };
}

export function createDesktopArtifactPublishIpcHandler(
  publishArtifactToRepoUseCase: Pick<PublishArtifactToRepoUseCase, "execute">,
) {
  return async (
    _event: unknown,
    request: DesktopArtifactPublishRequest,
  ): Promise<DesktopArtifactPublishResponse> => {
    const result = await publishArtifactToRepoUseCase.execute(
      mapDesktopArtifactPublishRequestToCommand(request),
    );
    if (!result.ok) {
      return mapIpcFailure(DESKTOP_ARTIFACT_PUBLISH_RESPONSE_CHANNEL, request, result.error);
    }

    return createDesktopArtifactPublishSuccessResponse(result.value, {
      requestId: request.requestId,
      correlationId: request.correlationId,
    });
  };
}

export function createDesktopArtifactPublishVerifyIpcHandler(
  verifyPublishedArtifactBackingUseCase: Pick<VerifyPublishedArtifactBackingUseCase, "execute">,
) {
  return async (
    _event: unknown,
    request: DesktopArtifactPublishVerifyRequest,
  ): Promise<DesktopArtifactPublishVerifyResponse> => {
    const result = await verifyPublishedArtifactBackingUseCase.execute(
      mapDesktopArtifactPublishVerifyRequestToCommand(request),
    );
    if (!result.ok) {
      return mapIpcFailure(DESKTOP_ARTIFACT_PUBLISH_VERIFY_RESPONSE_CHANNEL, request, result.error);
    }

    return createDesktopArtifactPublishVerifySuccessResponse(result.value, {
      requestId: request.requestId,
      correlationId: request.correlationId,
    });
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
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL.value,
    createDesktopArtifactMediaViewIpcHandler(dependencies.artifactMediaViewRetrieval),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL.value,
    createDesktopArtifactPublishIpcHandler(dependencies.publishArtifactToRepoUseCase),
  );
  dependencies.ipcMain.handle(
    DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL.value,
    createDesktopArtifactPublishVerifyIpcHandler(dependencies.verifyPublishedArtifactBackingUseCase),
  );
}
