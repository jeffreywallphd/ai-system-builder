import type { PrepareTrainingDatasetFromArtifactsCommand } from "../../../../application/use-cases";
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
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface PrepareTrainingDatasetFromArtifactsUseCasePort {
  startPrepareTrainingDataset: (command: PrepareTrainingDatasetFromArtifactsCommand, context?: { requestId?: string; correlationId?: string }) => Promise<any>;
  readPrepareTrainingDataset: (requestId: string, context?: { requestId?: string; correlationId?: string }) => Promise<any>;
  cancelPrepareTrainingDataset?: (requestId: string, context?: { requestId?: string; correlationId?: string }) => Promise<any>;
}
export interface RegisterDatasetPreparationIpcDependencies { ipcMain: IpcMainHandlePort; prepareTrainingDatasetFromArtifactsUseCase: PrepareTrainingDatasetFromArtifactsUseCasePort; }

export const createDesktopPrepareTrainingDatasetStartIpcHandler = (useCase: PrepareTrainingDatasetFromArtifactsUseCasePort) => async (_e:unknown, request: DesktopPrepareTrainingDatasetStartRequest): Promise<DesktopPrepareTrainingDatasetStartResponse> => {
  const result = await useCase.startPrepareTrainingDataset(request.payload.command,{requestId:request.requestId,correlationId:request.correlationId});
  if (result.ok) return createDesktopPrepareTrainingDatasetStartSuccessResponse(result.value,{requestId:result.requestId??request.requestId,correlationId:result.correlationId??request.correlationId});
  return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL,result.error.code,result.error.message,{details:result.error.details,requestId:result.requestId??request.requestId,correlationId:result.correlationId??request.correlationId}));
};

export const createDesktopPrepareTrainingDatasetTaskReadIpcHandler = (useCase: PrepareTrainingDatasetFromArtifactsUseCasePort) => async (_e:unknown, request: DesktopPrepareTrainingDatasetTaskReadRequest): Promise<DesktopPrepareTrainingDatasetTaskReadResponse> => {
  const result = await useCase.readPrepareTrainingDataset(request.payload.requestId,{requestId:request.requestId,correlationId:request.correlationId});
  if (result.ok) return createDesktopPrepareTrainingDatasetTaskReadSuccessResponse(result.value,{requestId:result.requestId??request.requestId,correlationId:result.correlationId??request.correlationId});
  return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL,result.error.code,result.error.message,{details:result.error.details,requestId:result.requestId??request.requestId,correlationId:result.correlationId??request.correlationId}));
};

export const createDesktopPrepareTrainingDatasetTaskCancelIpcHandler = (useCase: PrepareTrainingDatasetFromArtifactsUseCasePort) => async (_e:unknown, request: DesktopPrepareTrainingDatasetTaskCancelRequest): Promise<DesktopPrepareTrainingDatasetTaskCancelResponse> => {
  if (!useCase.cancelPrepareTrainingDataset) {
    return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL,"unavailable","Dataset preparation cancellation is unavailable.",{requestId:request.requestId,correlationId:request.correlationId}));
  }
  const result = await useCase.cancelPrepareTrainingDataset(request.payload.requestId,{requestId:request.requestId,correlationId:request.correlationId});
  if (result.ok) return createDesktopPrepareTrainingDatasetTaskCancelSuccessResponse(result.value,{requestId:result.requestId??request.requestId,correlationId:result.correlationId??request.correlationId});
  return createIpcFailureResponse(createIpcError(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL,result.error.code,result.error.message,{details:result.error.details,requestId:result.requestId??request.requestId,correlationId:result.correlationId??request.correlationId}));
};

export function registerDatasetPreparationIpc(dependencies: RegisterDatasetPreparationIpcDependencies): void {
  dependencies.ipcMain.handle(DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL.value,createDesktopPrepareTrainingDatasetStartIpcHandler(dependencies.prepareTrainingDatasetFromArtifactsUseCase));
  dependencies.ipcMain.handle(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL.value,createDesktopPrepareTrainingDatasetTaskReadIpcHandler(dependencies.prepareTrainingDatasetFromArtifactsUseCase));
  dependencies.ipcMain.handle(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL.value,createDesktopPrepareTrainingDatasetTaskCancelIpcHandler(dependencies.prepareTrainingDatasetFromArtifactsUseCase));
}
