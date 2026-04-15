import {
  normalizeStorageObjectDescriptor,
  type StorageObjectDescriptor,
  type StorageObjectMetadata,
} from "../storage";
import { createTransportOperation } from "../transport";
import { createApiError } from "./api-error";
import { createApiRequest, type ApiRequest } from "./api-request";
import {
  createApiFailureResponse,
  createApiSuccessResponse,
  type ApiResponse,
} from "./api-response";

const API_IMAGE_UPLOAD_OPERATION_SEGMENTS = ["image", "upload"] as const;

export const API_IMAGE_UPLOAD_OPERATION = createTransportOperation(
  ...API_IMAGE_UPLOAD_OPERATION_SEGMENTS,
);

export interface ApiImageUploadBoundaryContext {
  host: "server";
  source: string;
}

export interface ApiImageUploadRequestPayload {
  fileName: string;
  mediaType: string;
  bytes: Uint8Array;
  boundary: ApiImageUploadBoundaryContext;
}

export interface ApiImageUploadSuccessValue<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> {
  descriptor: StorageObjectDescriptor<TMetadata>;
}

export type ApiImageUploadRequest = ApiRequest<
  ApiImageUploadRequestPayload,
  typeof API_IMAGE_UPLOAD_OPERATION,
  Record<string, never>
>;

export type ApiImageUploadResponse<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
> = ApiResponse<
  ApiImageUploadSuccessValue<TMetadata>,
  Record<string, unknown>,
  typeof API_IMAGE_UPLOAD_OPERATION,
  Record<string, never>
>;

function normalizeRequiredTextField(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must be a non-empty, trimmed string.`);
  }

  return normalized;
}

function normalizeApiImageUploadPayload(
  payload: ApiImageUploadRequestPayload,
): ApiImageUploadRequestPayload {
  if (payload.bytes.length === 0) {
    throw new Error("bytes must contain at least one byte.");
  }

  return {
    fileName: normalizeRequiredTextField(payload.fileName, "fileName"),
    mediaType: normalizeRequiredTextField(payload.mediaType, "mediaType"),
    bytes: payload.bytes,
    boundary: {
      host: "server",
      source: normalizeRequiredTextField(payload.boundary.source, "boundary.source"),
    },
  };
}

export function createApiImageUploadRequest(
  payload: ApiImageUploadRequestPayload,
  options?: {
    requestId?: string;
    correlationId?: string;
  },
): ApiImageUploadRequest {
  return createApiRequest(
    API_IMAGE_UPLOAD_OPERATION,
    normalizeApiImageUploadPayload(payload),
    {
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    },
  );
}

export function createApiImageUploadSuccessResponse<
  TMetadata extends StorageObjectMetadata = StorageObjectMetadata,
>(
  descriptor: StorageObjectDescriptor<TMetadata>,
  options?: {
    requestId?: string;
    correlationId?: string;
  },
): ApiImageUploadResponse<TMetadata> {
  return createApiSuccessResponse(
    API_IMAGE_UPLOAD_OPERATION,
    {
      descriptor: normalizeStorageObjectDescriptor(descriptor),
    },
    {
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    },
  );
}

export function createApiImageUploadFailureResponse(
  code: "validation" | "internal" | "conflict" | "unavailable",
  message: string,
  options?: {
    details?: Record<string, unknown>;
    requestId?: string;
    correlationId?: string;
  },
): ApiImageUploadResponse {
  return createApiFailureResponse(
    createApiError(API_IMAGE_UPLOAD_OPERATION, code, message, {
      details: options?.details,
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    }),
  );
}
