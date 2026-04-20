import type { StagedArtifactDescriptor } from "../ingestion";
import { createTransportOperation } from "../transport";
import { createIpcChannel, type IpcChannel, type IpcChannelValue } from "./ipc-channel";
import { createIpcRequest, type IpcRequest } from "./ipc-request";
import { createIpcSuccessResponse, type IpcResponse } from "./ipc-response";

export const DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION = createTransportOperation(
  "artifact",
  "prepare-templated-dataset",
);

export const DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL = createIpcChannel(
  DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  "request",
);

export const DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL = createIpcChannel(
  DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  "response",
);

export interface DesktopDatasetPreparationBoundaryContext {
  host: "desktop";
  source: string;
}

export interface DesktopPrepareTemplatedDatasetRequestPayload {
  command: {
    sourceArtifactIds: string[];
    template: string;
    split: {
      trainRatio: number;
      testRatio: number;
      seed?: number;
    };
    outputFormat: "jsonl" | "json" | "csv";
    shuffle?: boolean;
  };
  boundary: DesktopDatasetPreparationBoundaryContext;
}

export interface DesktopPrepareTemplatedDatasetSuccessValue {
  result: {
    train: StagedArtifactDescriptor;
    test: StagedArtifactDescriptor;
    trainRowCount: number;
    testRowCount: number;
    warnings?: string[];
  };
}

export type DesktopPrepareTemplatedDatasetRequest = IpcRequest<
  DesktopPrepareTemplatedDatasetRequestPayload,
  typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  Record<string, never>,
  typeof DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL.value
>;

export type DesktopPrepareTemplatedDatasetResponse = IpcResponse<
  DesktopPrepareTemplatedDatasetSuccessValue,
  Record<string, unknown>,
  typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  Record<string, never>,
  typeof DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL.value
>;

function normalizeRequiredTextField(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${fieldName} must be a non-empty, trimmed string.`);
  }

  return normalized;
}

function normalizeBoundary(
  boundary: DesktopDatasetPreparationBoundaryContext,
): DesktopDatasetPreparationBoundaryContext {
  return {
    host: "desktop",
    source: normalizeRequiredTextField(boundary.source, "boundary.source"),
  };
}

export function createDesktopPrepareTemplatedDatasetRequest(
  payload: DesktopPrepareTemplatedDatasetRequestPayload,
  options?: { requestId?: string; correlationId?: string },
): DesktopPrepareTemplatedDatasetRequest {
  return createIpcRequest(
    DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL,
    {
      command: payload.command,
      boundary: normalizeBoundary(payload.boundary),
    },
    options,
  );
}

export function createDesktopPrepareTemplatedDatasetSuccessResponse(
  result: DesktopPrepareTemplatedDatasetSuccessValue["result"],
  options?: { requestId?: string; correlationId?: string },
): DesktopPrepareTemplatedDatasetResponse {
  return createIpcSuccessResponse(
    DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL,
    {
      result,
    },
    options,
  );
}

export function getDesktopPrepareTemplatedDatasetChannel(
  kind: "request",
): IpcChannel<
  typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  "request",
  IpcChannelValue<typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION, "request">
>;
export function getDesktopPrepareTemplatedDatasetChannel(
  kind: "response",
): IpcChannel<
  typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
  "response",
  IpcChannelValue<typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION, "response">
>;
export function getDesktopPrepareTemplatedDatasetChannel(
  kind: "request" | "response",
):
  | IpcChannel<
    typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
    "request",
    IpcChannelValue<typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION, "request">
  >
  | IpcChannel<
    typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION,
    "response",
    IpcChannelValue<typeof DESKTOP_DATASET_PREPARE_TEMPLATED_OPERATION, "response">
  > {
  return kind === "request"
    ? DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL
    : DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL;
}
