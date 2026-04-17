import {
  DESKTOP_ARTIFACT_BROWSE_OPERATION,
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_OPERATION,
  DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_OPERATION,
  DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_MEDIA_VIEW_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_READ_OPERATION,
  DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_OPERATION,
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
  createDesktopArtifactBrowseRequest,
  createDesktopArtifactContentReadRequest,
  createDesktopArtifactMediaViewRequest,
  createDesktopArtifactReadRequest,
  createDesktopImageUploadRequest,
  type DesktopArtifactBrowseRequest,
  type DesktopArtifactBrowseResponse,
  type DesktopArtifactContentReadRequest,
  type DesktopArtifactContentReadResponse,
  type DesktopArtifactMediaViewRequest,
  type DesktopArtifactMediaViewResponse,
  type DesktopArtifactReadRequest,
  type DesktopArtifactReadResponse,
  type DesktopImageUploadRequest,
  type DesktopImageUploadResponse,
} from "../../../../modules/contracts/ipc";

const DEFAULT_UPLOAD_SOURCE = "desktop.renderer.upload-form";
const DEFAULT_ARTIFACT_SOURCE = "desktop.renderer.artifact-browser";

export interface IpcRendererInvokePort {
  invoke: (channel: string, request: unknown) => Promise<unknown>;
}

export interface DesktopImageUploadBridgeInput {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
}

export interface DesktopArtifactBrowserLocator {
  storageKey: string;
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
  browseArtifacts: (context?: DesktopImageUploadBridgeContext) => Promise<DesktopArtifactBrowseResponse>;
  readArtifactDetail: (
    locator: DesktopArtifactBrowserLocator,
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactReadResponse>;
  readArtifactContentDescriptor: (
    locator: DesktopArtifactBrowserLocator,
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactContentReadResponse>;
  readArtifactViewerMedia: (
    locator: DesktopArtifactBrowserLocator,
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactMediaViewResponse>;
}

export interface CreateDesktopPreloadApiDependencies {
  ipcRenderer: IpcRendererInvokePort;
  uploadSource?: string;
  artifactSource?: string;
}

function assertDesktopEnvelopeResponse<TResponse extends { operation: string; channel: string }>(
  response: unknown,
  options: {
    operation: string;
    channel: string;
    message: string;
  },
): TResponse {
  if (
    typeof response !== "object"
    || response === null
    || !("operation" in response)
    || !("channel" in response)
    || (response as { operation?: string }).operation !== options.operation
    || (response as { channel?: string }).channel !== options.channel
  ) {
    throw new Error(options.message);
  }

  return response as TResponse;
}

export function createDesktopPreloadApi(
  dependencies: CreateDesktopPreloadApiDependencies,
): DesktopPreloadApi {
  const uploadSource = dependencies.uploadSource ?? DEFAULT_UPLOAD_SOURCE;
  const artifactSource = dependencies.artifactSource ?? DEFAULT_ARTIFACT_SOURCE;

  return {
    async uploadImage(input, context = {}) {
      const request: DesktopImageUploadRequest = createDesktopImageUploadRequest(
        {
          fileName: input.fileName,
          mediaType: input.mediaType,
          bytes: input.bytes,
          boundary: {
            host: "desktop",
            source: uploadSource,
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

      return assertDesktopEnvelopeResponse<DesktopImageUploadResponse>(response, {
        operation: DESKTOP_IMAGE_UPLOAD_OPERATION,
        channel: DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop image upload IPC response envelope.",
      });
    },

    async browseArtifacts(context = {}) {
      const request: DesktopArtifactBrowseRequest = createDesktopArtifactBrowseRequest(
        {
          artifactKind: "image",
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactBrowseResponse>(response, {
        operation: DESKTOP_ARTIFACT_BROWSE_OPERATION,
        channel: DESKTOP_ARTIFACT_BROWSE_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact browse IPC response envelope.",
      });
    },

    async readArtifactDetail(locator, context = {}) {
      const request: DesktopArtifactReadRequest = createDesktopArtifactReadRequest(
        {
          locator,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_READ_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactReadResponse>(response, {
        operation: DESKTOP_ARTIFACT_READ_OPERATION,
        channel: DESKTOP_ARTIFACT_READ_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact read IPC response envelope.",
      });
    },

    async readArtifactContentDescriptor(locator, context = {}) {
      const request: DesktopArtifactContentReadRequest = createDesktopArtifactContentReadRequest(
        {
          locator,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_CONTENT_READ_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactContentReadResponse>(response, {
        operation: DESKTOP_ARTIFACT_CONTENT_READ_OPERATION,
        channel: DESKTOP_ARTIFACT_CONTENT_READ_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact content read IPC response envelope.",
      });
    },

    async readArtifactViewerMedia(locator, context = {}) {
      const request: DesktopArtifactMediaViewRequest = createDesktopArtifactMediaViewRequest(
        {
          storageKey: locator.storageKey,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_MEDIA_VIEW_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactMediaViewResponse>(response, {
        operation: DESKTOP_ARTIFACT_MEDIA_VIEW_OPERATION,
        channel: DESKTOP_ARTIFACT_MEDIA_VIEW_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact media-view IPC response envelope.",
      });
    },
  };
}
