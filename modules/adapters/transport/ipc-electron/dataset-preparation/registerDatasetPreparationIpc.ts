import type {
  PrepareTemplatedDatasetFromArtifactsCommand,
  PrepareTemplatedDatasetFromArtifactsResult,
} from "../../../../application/use-cases";
import {
  DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL,
  DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL,
  createDesktopPrepareTemplatedDatasetSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  type DesktopPrepareTemplatedDatasetRequest,
  type DesktopPrepareTemplatedDatasetResponse,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface PrepareTemplatedDatasetFromArtifactsUseCasePort {
  execute: (
    command: PrepareTemplatedDatasetFromArtifactsCommand,
    context?: {
      requestId?: string;
      correlationId?: string;
    },
  ) => Promise<PrepareTemplatedDatasetFromArtifactsResult>;
}

export interface RegisterDatasetPreparationIpcDependencies {
  ipcMain: IpcMainHandlePort;
  prepareTemplatedDatasetFromArtifactsUseCase: PrepareTemplatedDatasetFromArtifactsUseCasePort;
}

function mapPrepareTemplatedDatasetResultToIpcResponse(
  result: PrepareTemplatedDatasetFromArtifactsResult,
  request: DesktopPrepareTemplatedDatasetRequest,
): DesktopPrepareTemplatedDatasetResponse {
  if (result.ok) {
    return createDesktopPrepareTemplatedDatasetSuccessResponse(result.value, {
      requestId: result.requestId ?? request.requestId,
      correlationId: result.correlationId ?? request.correlationId,
    });
  }

  return createIpcFailureResponse(
    createIpcError(
      DESKTOP_DATASET_PREPARE_TEMPLATED_RESPONSE_CHANNEL,
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

export function createDesktopPrepareTemplatedDatasetIpcHandler(
  useCase: PrepareTemplatedDatasetFromArtifactsUseCasePort,
) {
  return async (
    _event: unknown,
    request: DesktopPrepareTemplatedDatasetRequest,
  ): Promise<DesktopPrepareTemplatedDatasetResponse> => {
    const result = await useCase.execute(
      request.payload.command,
      {
        requestId: request.requestId,
        correlationId: request.correlationId,
      },
    );

    return mapPrepareTemplatedDatasetResultToIpcResponse(result, request);
  };
}

export function registerDatasetPreparationIpc(
  dependencies: RegisterDatasetPreparationIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    DESKTOP_DATASET_PREPARE_TEMPLATED_REQUEST_CHANNEL.value,
    createDesktopPrepareTemplatedDatasetIpcHandler(dependencies.prepareTemplatedDatasetFromArtifactsUseCase),
  );
}
