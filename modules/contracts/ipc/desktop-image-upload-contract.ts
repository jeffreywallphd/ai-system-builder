import {
  normalizeStagedDataDescriptor,
  type StagedDataDescriptor,
  type StagedDataMetadata,
} from "../ingestion";
import { IMAGE_UPLOAD_OPERATION } from "../image-upload";
import {
  createIpcChannel,
  type IpcChannel,
  type IpcChannelValue,
} from "./ipc-channel";
import {
  createIpcRequest,
  type IpcRequest,
} from "./ipc-request";
import {
  createIpcSuccessResponse,
  type IpcResponse,
} from "./ipc-response";

export const DESKTOP_IMAGE_UPLOAD_OPERATION = IMAGE_UPLOAD_OPERATION;

export const DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL = createIpcChannel(
  DESKTOP_IMAGE_UPLOAD_OPERATION,
  "request",
);

export const DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL = createIpcChannel(
  DESKTOP_IMAGE_UPLOAD_OPERATION,
  "response",
);

export interface DesktopImageUploadBoundaryContext {
  host: "desktop";
  source: string;
}

export interface DesktopImageUploadRequestPayload {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  boundary: DesktopImageUploadBoundaryContext;
}

export interface DesktopImageUploadSuccessValue<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> {
  descriptor: StagedDataDescriptor<TMetadata>;
}

export type DesktopImageUploadRequest = IpcRequest<
  DesktopImageUploadRequestPayload,
  typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
  Record<string, never>,
  typeof DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value
>;

export type DesktopImageUploadResponse<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
> = IpcResponse<
  DesktopImageUploadSuccessValue<TMetadata>,
  Record<string, unknown>,
  typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
  Record<string, never>,
  typeof DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL.value
>;

function normalizeRequiredTextField(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must be a non-empty, trimmed string.`);
  }

  return normalized;
}

function normalizeDesktopImageUploadPayload(
  payload: DesktopImageUploadRequestPayload,
): DesktopImageUploadRequestPayload {
  if (payload.bytes.length === 0) {
    throw new Error("bytes must contain at least one byte.");
  }

  return {
    fileName: normalizeRequiredTextField(payload.fileName, "fileName"),
    mediaType: normalizeRequiredTextField(payload.mediaType, "mediaType"),
    bytes: payload.bytes,
    boundary: {
      host: "desktop",
      source: normalizeRequiredTextField(payload.boundary.source, "boundary.source"),
    },
  };
}

export function createDesktopImageUploadRequest(
  payload: DesktopImageUploadRequestPayload,
  options?: {
    requestId?: string;
    correlationId?: string;
  },
): DesktopImageUploadRequest {
  return createIpcRequest(
    DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL,
    normalizeDesktopImageUploadPayload(payload),
    {
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    },
  );
}

export function createDesktopImageUploadSuccessResponse<
  TMetadata extends StagedDataMetadata = StagedDataMetadata,
>(
  descriptor: StagedDataDescriptor<TMetadata>,
  options?: {
    requestId?: string;
    correlationId?: string;
  },
): DesktopImageUploadResponse<TMetadata> {
  return createIpcSuccessResponse(
    DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL,
    {
      descriptor: normalizeStagedDataDescriptor(descriptor),
    },
    {
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    },
  );
}

export function isDesktopImageUploadRequestChannel(
  value: string,
): value is IpcChannelValue<
  typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
  "request"
> {
  return value === DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL.value;
}

export function isDesktopImageUploadResponseChannel(
  value: string,
): value is IpcChannelValue<
  typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
  "response"
> {
  return value === DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL.value;
}

export function getDesktopImageUploadChannel(
  kind: "request",
): IpcChannel<
  typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
  "request",
  IpcChannelValue<typeof DESKTOP_IMAGE_UPLOAD_OPERATION, "request">
>;
export function getDesktopImageUploadChannel(
  kind: "response",
): IpcChannel<
  typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
  "response",
  IpcChannelValue<typeof DESKTOP_IMAGE_UPLOAD_OPERATION, "response">
>;
export function getDesktopImageUploadChannel(
  kind: "request" | "response",
):
  | IpcChannel<
    typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
    "request",
    IpcChannelValue<typeof DESKTOP_IMAGE_UPLOAD_OPERATION, "request">
  >
  | IpcChannel<
    typeof DESKTOP_IMAGE_UPLOAD_OPERATION,
    "response",
    IpcChannelValue<typeof DESKTOP_IMAGE_UPLOAD_OPERATION, "response">
  > {
  return kind === "request"
    ? DESKTOP_IMAGE_UPLOAD_REQUEST_CHANNEL
    : DESKTOP_IMAGE_UPLOAD_RESPONSE_CHANNEL;
}
