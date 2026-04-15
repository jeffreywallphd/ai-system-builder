import type {
  DesktopImageUploadRequest,
  DesktopImageUploadResponse,
} from "../../../contracts/ipc";
import {
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
  createDesktopImageUploadSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
} from "../../../contracts/ipc";
import type { StoreImageUploadUseCaseResult } from "../../../application/use-cases/store-image-upload.use-case";

export interface StoreImageUploadUseCasePort {
  execute: (
    request: DesktopImageUploadRequest["payload"],
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

export function createDesktopImageUploadIpcHandler(
  storeImageUploadUseCase: StoreImageUploadUseCasePort,
) {
  return async (
    _event: unknown,
    request: DesktopImageUploadRequest,
  ): Promise<DesktopImageUploadResponse> => {
    const result = await storeImageUploadUseCase.execute(request.payload, {
      requestId: request.requestId,
      correlationId: request.correlationId,
    });

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
