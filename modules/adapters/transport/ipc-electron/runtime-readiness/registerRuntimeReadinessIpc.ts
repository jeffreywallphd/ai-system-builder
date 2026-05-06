import type { RuntimeReadinessPort } from "../../../../application/ports/runtime";
import { normalizeRuntimeCapabilityId } from "../../../../contracts/runtime";
import {
  DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_REQUEST_CHANNEL,
  DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_RESPONSE_CHANNEL,
  DESKTOP_RUNTIME_READINESS_READ_REQUEST_CHANNEL,
  DESKTOP_RUNTIME_READINESS_READ_RESPONSE_CHANNEL,
  createDesktopRuntimeCapabilityStatusReadSuccessResponse,
  createDesktopRuntimeReadinessReadSuccessResponse,
  createIpcError,
  createIpcFailureResponse,
  type DesktopRuntimeCapabilityStatusReadRequest,
  type DesktopRuntimeCapabilityStatusReadResponse,
  type DesktopRuntimeReadinessReadRequest,
  type DesktopRuntimeReadinessReadResponse,
} from "../../../../contracts/ipc";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface RegisterRuntimeReadinessIpcDependencies {
  ipcMain: IpcMainHandlePort;
  runtimeReadiness: RuntimeReadinessPort;
}

function sanitizeHandlerError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  return message.length > 0 ? message : fallback;
}

export function createDesktopRuntimeReadinessReadIpcHandler(
  dependencies: Pick<RegisterRuntimeReadinessIpcDependencies, "runtimeReadiness">,
) {
  return async (
    _event: unknown,
    request: DesktopRuntimeReadinessReadRequest,
  ): Promise<DesktopRuntimeReadinessReadResponse> => {
    try {
      const snapshot = await dependencies.runtimeReadiness.getReadinessSnapshot();
      return createDesktopRuntimeReadinessReadSuccessResponse(snapshot, {
        requestId: request.requestId,
        correlationId: request.correlationId,
      });
    } catch (error) {
      return createIpcFailureResponse(createIpcError(
        DESKTOP_RUNTIME_READINESS_READ_RESPONSE_CHANNEL,
        "internal",
        sanitizeHandlerError(error, "Failed to read runtime readiness."),
        { requestId: request.requestId, correlationId: request.correlationId },
      ));
    }
  };
}

export function createDesktopRuntimeCapabilityStatusReadIpcHandler(
  dependencies: Pick<RegisterRuntimeReadinessIpcDependencies, "runtimeReadiness">,
) {
  return async (
    _event: unknown,
    request: DesktopRuntimeCapabilityStatusReadRequest,
  ): Promise<DesktopRuntimeCapabilityStatusReadResponse> => {
    let capabilityId;
    try {
      capabilityId = normalizeRuntimeCapabilityId(request.payload.capabilityId);
    } catch {
      return createIpcFailureResponse(createIpcError(
        DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_RESPONSE_CHANNEL,
        "validation",
        "Unknown runtime capability id.",
        {
          details: { field: "capabilityId" },
          requestId: request.requestId,
          correlationId: request.correlationId,
        },
      ));
    }

    try {
      const status = await dependencies.runtimeReadiness.getCapabilityStatus(capabilityId);
      return createDesktopRuntimeCapabilityStatusReadSuccessResponse(status, {
        requestId: request.requestId,
        correlationId: request.correlationId,
      });
    } catch (error) {
      return createIpcFailureResponse(createIpcError(
        DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_RESPONSE_CHANNEL,
        "internal",
        sanitizeHandlerError(error, "Failed to read runtime capability status."),
        { requestId: request.requestId, correlationId: request.correlationId },
      ));
    }
  };
}

export function registerRuntimeReadinessIpc(
  dependencies: RegisterRuntimeReadinessIpcDependencies,
): void {
  dependencies.ipcMain.handle(
    DESKTOP_RUNTIME_READINESS_READ_REQUEST_CHANNEL.value,
    createDesktopRuntimeReadinessReadIpcHandler({ runtimeReadiness: dependencies.runtimeReadiness }),
  );

  dependencies.ipcMain.handle(
    DESKTOP_RUNTIME_CAPABILITY_STATUS_READ_REQUEST_CHANNEL.value,
    createDesktopRuntimeCapabilityStatusReadIpcHandler({ runtimeReadiness: dependencies.runtimeReadiness }),
  );
}
