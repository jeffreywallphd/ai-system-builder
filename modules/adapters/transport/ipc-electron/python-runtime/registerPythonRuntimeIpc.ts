import {
  DESKTOP_PYTHON_RUNTIME_CONTROL_REQUEST_CHANNEL,
  DESKTOP_PYTHON_RUNTIME_CONTROL_RESPONSE_CHANNEL,
  DESKTOP_PYTHON_RUNTIME_STATUS_READ_REQUEST_CHANNEL,
  DESKTOP_PYTHON_RUNTIME_STATUS_READ_RESPONSE_CHANNEL,
  createDesktopPythonRuntimeControlSuccessResponse,
  createDesktopPythonRuntimeStatusReadSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  type DesktopPythonRuntimeControlRequest,
  type DesktopPythonRuntimeControlResponse,
  type DesktopPythonRuntimeStatusPayload,
  type DesktopPythonRuntimeStatusReadRequest,
  type DesktopPythonRuntimeStatusReadResponse,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface PythonRuntimeControlPort {
  startPythonRuntime: () => Promise<void>;
  stopPythonRuntime: () => Promise<void>;
  restartPythonRuntime: () => Promise<void>;
  readPythonRuntimeStatus: () => Promise<DesktopPythonRuntimeStatusPayload>;
}

export interface RegisterPythonRuntimeIpcDependencies extends PythonRuntimeControlPort {
  ipcMain: IpcMainHandlePort;
}

function mapRuntimeErrorToIpcFailure(
  channel:
    | typeof DESKTOP_PYTHON_RUNTIME_STATUS_READ_RESPONSE_CHANNEL
    | typeof DESKTOP_PYTHON_RUNTIME_CONTROL_RESPONSE_CHANNEL,
  operation: string,
  request: { requestId?: string; correlationId?: string },
  error: unknown,
) {
  return createIpcFailureResponse(createIpcError(
    channel,
    "internal",
    error instanceof Error ? error.message : "Python runtime operation failed.",
    {
      requestId: request.requestId,
      correlationId: request.correlationId,
      details: {
        operation,
      },
    },
  ));
}

export function createDesktopPythonRuntimeStatusReadIpcHandler(
  dependencies: Pick<RegisterPythonRuntimeIpcDependencies, "readPythonRuntimeStatus">,
) {
  return async (
    _event: unknown,
    request: DesktopPythonRuntimeStatusReadRequest,
  ): Promise<DesktopPythonRuntimeStatusReadResponse> => {
    try {
      const status = await dependencies.readPythonRuntimeStatus();
      return createDesktopPythonRuntimeStatusReadSuccessResponse(
        status,
        {
          requestId: request.requestId,
          correlationId: request.correlationId,
        },
      );
    } catch (error) {
      return mapRuntimeErrorToIpcFailure(
        DESKTOP_PYTHON_RUNTIME_STATUS_READ_RESPONSE_CHANNEL,
        "status-read",
        request,
        error,
      ) as DesktopPythonRuntimeStatusReadResponse;
    }
  };
}

export function createDesktopPythonRuntimeControlIpcHandler(
  dependencies: Pick<RegisterPythonRuntimeIpcDependencies, "startPythonRuntime" | "stopPythonRuntime" | "restartPythonRuntime" | "readPythonRuntimeStatus">,
) {
  return async (
    _event: unknown,
    request: DesktopPythonRuntimeControlRequest,
  ): Promise<DesktopPythonRuntimeControlResponse> => {
    try {
      if (request.payload.action === "start") {
        await dependencies.startPythonRuntime();
      } else if (request.payload.action === "stop") {
        await dependencies.stopPythonRuntime();
      } else {
        await dependencies.restartPythonRuntime();
      }

      const status = await dependencies.readPythonRuntimeStatus();
      return createDesktopPythonRuntimeControlSuccessResponse(
        status,
        {
          requestId: request.requestId,
          correlationId: request.correlationId,
        },
      );
    } catch (error) {
      return mapRuntimeErrorToIpcFailure(
        DESKTOP_PYTHON_RUNTIME_CONTROL_RESPONSE_CHANNEL,
        request.payload.action,
        request,
        error,
      ) as DesktopPythonRuntimeControlResponse;
    }
  };
}

export function registerPythonRuntimeIpc(
  dependencies: RegisterPythonRuntimeIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    DESKTOP_PYTHON_RUNTIME_STATUS_READ_REQUEST_CHANNEL.value,
    createDesktopPythonRuntimeStatusReadIpcHandler({
      readPythonRuntimeStatus: dependencies.readPythonRuntimeStatus,
    }),
  );

  dependencies.ipcMain.handle(
    DESKTOP_PYTHON_RUNTIME_CONTROL_REQUEST_CHANNEL.value,
    createDesktopPythonRuntimeControlIpcHandler({
      startPythonRuntime: dependencies.startPythonRuntime,
      stopPythonRuntime: dependencies.stopPythonRuntime,
      restartPythonRuntime: dependencies.restartPythonRuntime,
      readPythonRuntimeStatus: dependencies.readPythonRuntimeStatus,
    }),
  );
}
