import {
  DESKTOP_IMAGE_UPLOAD_OPERATION,
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
  createDesktopImageUploadRequest,
  type DesktopImageUploadRequest,
  type DesktopImageUploadResponse,
} from "../../../../modules/contracts/ipc";

const DEFAULT_UPLOAD_SOURCE = "desktop.renderer.upload-form";

export interface IpcRendererInvokePort {
  invoke: (
    channel: string,
    request: DesktopImageUploadRequest,
  ) => Promise<DesktopImageUploadResponse>;
}

export interface DesktopImageUploadBridgeInput {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface DesktopImageUploadBridgeContext {
  requestId?: string;
  correlationId?: string;
}

export interface DesktopPreloadApi {
  uploadImage: (
    input: DesktopImageUploadBridgeInput,
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopImageUploadResponse>;
}

export interface CreateDesktopPreloadApiDependencies {
  ipcRenderer: IpcRendererInvokePort;
  uploadSource?: string;
}

function assertDesktopImageUploadResponse(
  response: DesktopImageUploadResponse,
): DesktopImageUploadResponse {
  if (
    response.operation !== DESKTOP_IMAGE_UPLOAD_OPERATION
    || response.channel !== DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL.value
  ) {
    throw new Error("Received invalid desktop image upload IPC response envelope.");
  }

  return response;
}

export function createDesktopPreloadApi(
  dependencies: CreateDesktopPreloadApiDependencies,
): DesktopPreloadApi {
  const source = dependencies.uploadSource ?? DEFAULT_UPLOAD_SOURCE;

  return {
    async uploadImage(input, context = {}) {
      const request = createDesktopImageUploadRequest(
        {
          fileName: input.fileName,
          mediaType: input.mediaType,
          bytes: input.bytes,
          boundary: {
            host: "desktop",
            source,
          },
        },
        {
          requestId: context.requestId,
          correlationId: context.correlationId,
        },
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopImageUploadResponse(response);
    },
  };
}
