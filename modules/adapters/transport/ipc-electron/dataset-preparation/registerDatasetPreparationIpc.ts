import type {
  PrepareTrainingDatasetFromArtifactsCommand,
  PrepareTrainingDatasetFromArtifactsValue,
} from "../../../../application/use-cases";
import type { ContractResult } from "../../../../contracts/shared";
import type { PythonRuntimeTaskStatusResult } from "../../../../contracts/runtime";
import {
  DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL,
  DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL,
  DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL,
  DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL,
  DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL,
  DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL,
  createDesktopPrepareTrainingDatasetStartSuccessResponse,
  createDesktopPrepareTrainingDatasetTaskReadSuccessResponse,
  createDesktopPrepareTrainingDatasetTaskCancelSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  type DesktopPrepareTrainingDatasetStartRequest,
  type DesktopPrepareTrainingDatasetStartResponse,
  type DesktopPrepareTrainingDatasetTaskReadRequest,
  type DesktopPrepareTrainingDatasetTaskReadResponse,
  type DesktopPrepareTrainingDatasetTaskCancelRequest,
  type DesktopPrepareTrainingDatasetTaskCancelResponse,
  type DesktopPrepareTrainingDatasetTaskReadSuccessValue,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

type StartResultValue = { requestId: string; taskType: string; accepted: true; status: "queued" | "running"; startedAt?: string; updatedAt?: string; metadata?: Record<string, unknown> };
type ReadResultValue = PythonRuntimeTaskStatusResult | { requestId: string; taskType: string; status: "succeeded"; result: PrepareTrainingDatasetFromArtifactsValue; startedAt?: string; updatedAt?: string; completedAt?: string };
type CancelResultValue = { requestId: string; cancelled: boolean; status: "cancelled" | "running" | "unknown" };

export interface PrepareTrainingDatasetFromArtifactsUseCasePort {
  startPrepareTrainingDataset: (command: PrepareTrainingDatasetFromArtifactsCommand, context?: { requestId?: string; correlationId?: string }) => Promise<ContractResult<StartResultValue>>;
  readPrepareTrainingDataset: (requestId: string, context?: { requestId?: string; correlationId?: string }) => Promise<ContractResult<ReadResultValue>>;
  cancelPrepareTrainingDataset?: (requestId: string, context?: { requestId?: string; correlationId?: string }) => Promise<ContractResult<CancelResultValue>>;
}
export interface RegisterDatasetPreparationIpcDependencies { ipcMain: IpcMainHandlePort; prepareTrainingDatasetUseCase: PrepareTrainingDatasetFromArtifactsUseCasePort; }

function mapPrepareTrainingDatasetTaskStatusToIpcValue(value: ReadResultValue): DesktopPrepareTrainingDatasetTaskReadSuccessValue {
  const shared = { requestId: value.requestId, taskType: value.taskType, startedAt: value.startedAt, updatedAt: value.updatedAt };
  if (value.status === "succeeded") {
    if ("result" in value) {
      return { ...shared, status: "succeeded", result: value.result, completedAt: value.completedAt };
    }
    return { ...shared, status: "unknown", message: "Dataset preparation succeeded without materialized result.", completedAt: value.completedAt };
  }
  if (value.status === "failed") return { ...shared, status: "failed", error: value.error, completedAt: value.completedAt };
  if (value.status === "cancelled") return { ...shared, status: "cancelled", message: value.message, progress: value.progress, completedAt: value.completedAt };
  if (value.status === "unknown") return { ...shared, status: "unknown", message: value.message, progress: value.progress, completedAt: value.completedAt };
  return { ...shared, status: value.status, progress: value.progress };
}

export const createDesktopPrepareTrainingDatasetStartIpcHandler = (useCase: PrepareTrainingDatasetFromArtifactsUseCasePort) => async (_e: unknown, request: DesktopPrepareTrainingDatasetStartRequest): Promise<DesktopPrepareTrainingDatasetStartResponse> => {
  const result = await useCase.startPrepareTrainingDataset(request.payload.command, { requestId: request.requestId, correlationId: request.correlationId });
  if (result.ok) return createDesktopPrepareTrainingDatasetStartSuccessResponse(result.value, { requestId: result.requestId ?? request.requestId, correlationId: result.correlationId ?? request.correlationId });
  return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL, result.error.code, result.error.message, { details: result.error.details, requestId: result.requestId ?? request.requestId, correlationId: result.correlationId ?? request.correlationId }));
};

export const createDesktopPrepareTrainingDatasetTaskReadIpcHandler = (useCase: PrepareTrainingDatasetFromArtifactsUseCasePort) => async (_e: unknown, request: DesktopPrepareTrainingDatasetTaskReadRequest): Promise<DesktopPrepareTrainingDatasetTaskReadResponse> => {
  const result = await useCase.readPrepareTrainingDataset(request.payload.requestId, { requestId: request.requestId, correlationId: request.correlationId });
  if (result.ok) return createDesktopPrepareTrainingDatasetTaskReadSuccessResponse(mapPrepareTrainingDatasetTaskStatusToIpcValue(result.value), { requestId: result.requestId ?? request.requestId, correlationId: result.correlationId ?? request.correlationId });
  return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL, result.error.code, result.error.message, { details: result.error.details, requestId: result.requestId ?? request.requestId, correlationId: result.correlationId ?? request.correlationId }));
};

export const createDesktopPrepareTrainingDatasetTaskCancelIpcHandler = (useCase: PrepareTrainingDatasetFromArtifactsUseCasePort) => async (_e: unknown, request: DesktopPrepareTrainingDatasetTaskCancelRequest): Promise<DesktopPrepareTrainingDatasetTaskCancelResponse> => {
  if (!useCase.cancelPrepareTrainingDataset) {
    return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL, "unavailable", "Dataset preparation cancellation is unavailable.", { requestId: request.requestId, correlationId: request.correlationId }));
  }
  const result = await useCase.cancelPrepareTrainingDataset(request.payload.requestId, { requestId: request.requestId, correlationId: request.correlationId });
  if (result.ok) return createDesktopPrepareTrainingDatasetTaskCancelSuccessResponse(result.value, { requestId: result.requestId ?? request.requestId, correlationId: result.correlationId ?? request.correlationId });
  return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL, result.error.code, result.error.message, { details: result.error.details, requestId: result.requestId ?? request.requestId, correlationId: result.correlationId ?? request.correlationId }));
};

export function registerDatasetPreparationIpc(dependencies: RegisterDatasetPreparationIpcDependencies): void {
  dependencies.ipcMain.handle(DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL.value, createDesktopPrepareTrainingDatasetStartIpcHandler(dependencies.prepareTrainingDatasetUseCase));
  dependencies.ipcMain.handle(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL.value, createDesktopPrepareTrainingDatasetTaskReadIpcHandler(dependencies.prepareTrainingDatasetUseCase));
  dependencies.ipcMain.handle(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL.value, createDesktopPrepareTrainingDatasetTaskCancelIpcHandler(dependencies.prepareTrainingDatasetUseCase));
}
