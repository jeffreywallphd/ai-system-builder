import type {
  DesktopImageUploadRequest,
  DesktopImageUploadRequestPayload,
  DesktopImageUploadResponse,
} from "../../../contracts/ipc";
import {
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
  createDesktopImageUploadSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
} from "../../../contracts/ipc";
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

export interface IpcMainHandlePort {
  handle: (
    channel: string,
    listener: (
      event: unknown,
      request: DesktopImageUploadRequest,
    ) => Promise<DesktopImageUploadResponse>,
  ) => void;
}

export interface RegisterElectronIpcDependencies {
  ipcMain: IpcMainHandlePort;
  storeImageUploadUseCase: StoreImageUploadUseCasePort;
}

function mapIpcRequestToStoreImageUploadCommand(
  payload: DesktopImageUploadRequestPayload,
): StoreImageUploadCommand {
  return {
    fileName: payload.fileName,
    mediaType: payload.mediaType,
    bytes: payload.bytes,
  };
}

function mapIpcRequestToStoreImageUploadCommandContext(
  payload: DesktopImageUploadRequestPayload,
): StoreImageUploadCommandContext {
  return {
    host: payload.boundary.host,
    source: payload.boundary.source,
  };
}

function mapStoreImageUploadResultToIpcResponse(
  result: StoreImageUploadUseCaseResult,
  request: DesktopImageUploadRequest,
): DesktopImageUploadResponse {
  if (result.ok) {
    return createDesktopImageUploadSuccessResponse(result.value.descriptor, {
      requestId: result.requestId ?? request.requestId,
      correlationId: result.correlationId ?? request.correlationId,
    });
  }

  return createIpcFailureResponse(
    createIpcError(
      DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
      result.error.code,
      result.error.message,
      {
        details: result.error.details,
        requestId: result.requestId ?? request.requestId,
        correlationId: result.correlationId ?? request.correlationId,
      },
    ),
  );
}

export function createDesktopImageUploadIpcHandler(
  storeImageUploadUseCase: StoreImageUploadUseCasePort,
) {
  return async (
    _event: unknown,
    request: DesktopImageUploadRequest,
  ): Promise<DesktopImageUploadResponse> => {
    const result = await storeImageUploadUseCase.execute(
      mapIpcRequestToStoreImageUploadCommand(request.payload),
      mapIpcRequestToStoreImageUploadCommandContext(request.payload),
      {
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    );

    return mapStoreImageUploadResultToIpcResponse(result, request);
  };
}

export function registerElectronIpc(
  dependencies: RegisterElectronIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value,
    createDesktopImageUploadIpcHandler(dependencies.storeImageUploadUseCase),
  );
}
