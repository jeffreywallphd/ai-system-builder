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
  DESKTOP_ARTIFACT_PUBLISH_OPERATION,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_OPERATION,
  DESKTOP_ARTIFACT_SOURCE_VERIFY_OPERATION,
  DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_PUBLISH_VERIFY_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_SOURCE_VERIFY_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_SOURCE_VERIFY_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_REGISTER_FROM_REPO_OPERATION,
  DESKTOP_ARTIFACT_REGISTER_FROM_REPO_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_REGISTER_FROM_REPO_RESPONSE_CHANNEL,
  DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_OPERATION,
  DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_REQUEST_CHANNEL,
  DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_RESPONSE_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_OPERATION,
  DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
  DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
  createDesktopArtifactBrowseRequest,
  createDesktopArtifactContentReadRequest,
  createDesktopArtifactMediaViewRequest,
  createDesktopArtifactReadRequest,
  createDesktopArtifactPublishRequest,
  createDesktopArtifactPublishVerifyRequest,
  createDesktopArtifactSourceVerifyRequest,
  createDesktopArtifactRegisterFromRepoRequest,
  createDesktopArtifactLocalizeFromRepoRequest,
  createDesktopImageUploadRequest,
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
  type DesktopArtifactSourceVerifyRequest,
  type DesktopArtifactSourceVerifyResponse,
  type DesktopArtifactRegisterFromRepoRequest,
  type DesktopArtifactRegisterFromRepoResponse,
  type DesktopArtifactLocalizeFromRepoRequest,
  type DesktopArtifactLocalizeFromRepoResponse,
  type DesktopImageUploadRequest,
  type DesktopImageUploadResponse,
  DESKTOP_HUGGING_FACE_TOKEN_GET_OPERATION,
  DESKTOP_HUGGING_FACE_TOKEN_GET_REQUEST_CHANNEL,
  DESKTOP_HUGGING_FACE_TOKEN_GET_RESPONSE_CHANNEL,
  DESKTOP_HUGGING_FACE_TOKEN_SET_OPERATION,
  DESKTOP_HUGGING_FACE_TOKEN_SET_REQUEST_CHANNEL,
  DESKTOP_HUGGING_FACE_TOKEN_SET_RESPONSE_CHANNEL,
  DESKTOP_HUGGING_FACE_TOKEN_CLEAR_OPERATION,
  DESKTOP_HUGGING_FACE_TOKEN_CLEAR_REQUEST_CHANNEL,
  DESKTOP_HUGGING_FACE_TOKEN_CLEAR_RESPONSE_CHANNEL,
  createDesktopHuggingFaceTokenGetRequest,
  createDesktopHuggingFaceTokenSetRequest,
  createDesktopHuggingFaceTokenClearRequest,
  type DesktopHuggingFaceTokenGetResponse,
  type DesktopHuggingFaceTokenSetResponse,
  type DesktopHuggingFaceTokenClearResponse,
  DESKTOP_HUGGING_FACE_NAMESPACE_DATASETS_BROWSE_OPERATION,
  DESKTOP_HUGGING_FACE_NAMESPACE_DATASETS_BROWSE_REQUEST_CHANNEL,
  DESKTOP_HUGGING_FACE_NAMESPACE_DATASETS_BROWSE_RESPONSE_CHANNEL,
  DESKTOP_HUGGING_FACE_DATASET_PARQUET_FILES_BROWSE_OPERATION,
  DESKTOP_HUGGING_FACE_DATASET_PARQUET_FILES_BROWSE_REQUEST_CHANNEL,
  DESKTOP_HUGGING_FACE_DATASET_PARQUET_FILES_BROWSE_RESPONSE_CHANNEL,
  createDesktopHuggingFaceNamespaceDatasetsBrowseRequest,
  createDesktopHuggingFaceDatasetParquetFilesBrowseRequest,
  type DesktopHuggingFaceNamespaceDatasetsBrowseResponse,
  type DesktopHuggingFaceDatasetParquetFilesBrowseResponse,
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
  getHuggingFaceTokenStatus: (
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopHuggingFaceTokenGetResponse>;
  setHuggingFaceToken: (
    input: { token: string },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopHuggingFaceTokenSetResponse>;
  clearHuggingFaceToken: (
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopHuggingFaceTokenClearResponse>;
  browseHuggingFaceNamespaceDatasets: (
    input: { namespace: string },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopHuggingFaceNamespaceDatasetsBrowseResponse>;
  browseHuggingFaceDatasetParquetFiles: (
    input: { repository: string; revision?: string },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopHuggingFaceDatasetParquetFilesBrowseResponse>;
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
  publishArtifactToRepo: (
    input: {
      artifactId: string;
      target: {
        provider: string;
        repository: string;
        path: string;
        revision?: string;
      };
      mediaType?: string;
    },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactPublishResponse>;
  verifyPublishedArtifactBacking: (
    input: {
      artifactId: string;
    },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactPublishVerifyResponse>;
  verifyImportedArtifactSourceBacking: (
    input: {
      artifactId: string;
    },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactSourceVerifyResponse>;
  registerArtifactFromRepo: (
    input: {
      target: {
        provider: string;
        repository: string;
        path: string;
        revision?: string;
      };
      artifactKind?: "image";
      mediaType?: string;
    },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactRegisterFromRepoResponse>;
  localizeArtifactFromRepo: (
    input: {
      artifactId: string;
    },
    context?: DesktopImageUploadBridgeContext,
  ) => Promise<DesktopArtifactLocalizeFromRepoResponse>;
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
    async getHuggingFaceTokenStatus(context = {}) {
      const request = createDesktopHuggingFaceTokenGetRequest(context);
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_HUGGING_FACE_TOKEN_GET_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopHuggingFaceTokenGetResponse>(response, {
        operation: DESKTOP_HUGGING_FACE_TOKEN_GET_OPERATION,
        channel: DESKTOP_HUGGING_FACE_TOKEN_GET_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop Hugging Face token status IPC response envelope.",
      });
    },

    async setHuggingFaceToken(input, context = {}) {
      const request = createDesktopHuggingFaceTokenSetRequest(
        { token: input.token },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_HUGGING_FACE_TOKEN_SET_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopHuggingFaceTokenSetResponse>(response, {
        operation: DESKTOP_HUGGING_FACE_TOKEN_SET_OPERATION,
        channel: DESKTOP_HUGGING_FACE_TOKEN_SET_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop Hugging Face token set IPC response envelope.",
      });
    },

    async clearHuggingFaceToken(context = {}) {
      const request = createDesktopHuggingFaceTokenClearRequest(context);
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_HUGGING_FACE_TOKEN_CLEAR_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopHuggingFaceTokenClearResponse>(response, {
        operation: DESKTOP_HUGGING_FACE_TOKEN_CLEAR_OPERATION,
        channel: DESKTOP_HUGGING_FACE_TOKEN_CLEAR_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop Hugging Face token clear IPC response envelope.",
      });
    },

    async browseHuggingFaceNamespaceDatasets(input, context = {}) {
      const request = createDesktopHuggingFaceNamespaceDatasetsBrowseRequest(
        {
          namespace: input.namespace,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_HUGGING_FACE_NAMESPACE_DATASETS_BROWSE_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopHuggingFaceNamespaceDatasetsBrowseResponse>(response, {
        operation: DESKTOP_HUGGING_FACE_NAMESPACE_DATASETS_BROWSE_OPERATION,
        channel: DESKTOP_HUGGING_FACE_NAMESPACE_DATASETS_BROWSE_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop Hugging Face namespace datasets IPC response envelope.",
      });
    },

    async browseHuggingFaceDatasetParquetFiles(input, context = {}) {
      const request = createDesktopHuggingFaceDatasetParquetFilesBrowseRequest(
        {
          repository: input.repository,
          revision: input.revision,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_HUGGING_FACE_DATASET_PARQUET_FILES_BROWSE_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopHuggingFaceDatasetParquetFilesBrowseResponse>(response, {
        operation: DESKTOP_HUGGING_FACE_DATASET_PARQUET_FILES_BROWSE_OPERATION,
        channel: DESKTOP_HUGGING_FACE_DATASET_PARQUET_FILES_BROWSE_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop Hugging Face dataset parquet-files IPC response envelope.",
      });
    },

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

    async publishArtifactToRepo(input, context = {}) {
      const request: DesktopArtifactPublishRequest = createDesktopArtifactPublishRequest(
        {
          artifactId: input.artifactId,
          target: {
            provider: input.target.provider,
            repository: input.target.repository,
            path: input.target.path,
            revision: input.target.revision,
          },
          mediaType: input.mediaType,
          verify: true,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_PUBLISH_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactPublishResponse>(response, {
        operation: DESKTOP_ARTIFACT_PUBLISH_OPERATION,
        channel: DESKTOP_ARTIFACT_PUBLISH_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact publish IPC response envelope.",
      });
    },

    async verifyPublishedArtifactBacking(input, context = {}) {
      const request: DesktopArtifactPublishVerifyRequest = createDesktopArtifactPublishVerifyRequest(
        {
          artifactId: input.artifactId,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_PUBLISH_VERIFY_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactPublishVerifyResponse>(response, {
        operation: DESKTOP_ARTIFACT_PUBLISH_VERIFY_OPERATION,
        channel: DESKTOP_ARTIFACT_PUBLISH_VERIFY_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact publish verify IPC response envelope.",
      });
    },

    async verifyImportedArtifactSourceBacking(input, context = {}) {
      const request: DesktopArtifactSourceVerifyRequest = createDesktopArtifactSourceVerifyRequest(
        {
          artifactId: input.artifactId,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_SOURCE_VERIFY_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactSourceVerifyResponse>(response, {
        operation: DESKTOP_ARTIFACT_SOURCE_VERIFY_OPERATION,
        channel: DESKTOP_ARTIFACT_SOURCE_VERIFY_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact source verify IPC response envelope.",
      });
    },


    async registerArtifactFromRepo(input, context = {}) {
      const request: DesktopArtifactRegisterFromRepoRequest = createDesktopArtifactRegisterFromRepoRequest(
        {
          target: input.target,
          artifactKind: input.artifactKind ?? "image",
          mediaType: input.mediaType,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_REGISTER_FROM_REPO_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactRegisterFromRepoResponse>(response, {
        operation: DESKTOP_ARTIFACT_REGISTER_FROM_REPO_OPERATION,
        channel: DESKTOP_ARTIFACT_REGISTER_FROM_REPO_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact register-from-repo IPC response envelope.",
      });
    },

    async localizeArtifactFromRepo(input, context = {}) {
      const request: DesktopArtifactLocalizeFromRepoRequest = createDesktopArtifactLocalizeFromRepoRequest(
        {
          artifactId: input.artifactId,
          boundary: {
            host: "desktop",
            source: artifactSource,
          },
        },
        context,
      );
      const response = await dependencies.ipcRenderer.invoke(
        DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_REQUEST_CHANNEL.value,
        request,
      );

      return assertDesktopEnvelopeResponse<DesktopArtifactLocalizeFromRepoResponse>(response, {
        operation: DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_OPERATION,
        channel: DESKTOP_ARTIFACT_LOCALIZE_FROM_REPO_RESPONSE_CHANNEL.value,
        message: "Received invalid desktop artifact localize-from-repo IPC response envelope.",
      });
    },
  };
}
