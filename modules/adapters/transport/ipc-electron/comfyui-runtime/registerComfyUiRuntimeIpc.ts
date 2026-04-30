import type { RuntimeInstallerPort } from "../../../../application/ports/runtime-installer/runtime-installer.port";
import { createIpcErrorResponse } from "../../../../contracts/ipc";
import {
  DESKTOP_COMFYUI_INSTALL_REPAIR_REQUEST_CHANNEL,
  DESKTOP_COMFYUI_INSTALL_STATUS_READ_REQUEST_CHANNEL,
  createDesktopComfyUiRepairInstallSuccessResponse,
  createDesktopComfyUiInstallStatusSuccessResponse,
} from "../../../../contracts/ipc/desktop-comfyui-runtime-contract";
import type { IpcMainHandlePort } from "../ipcMainHandlePort";

export interface RegisterComfyUiRuntimeIpcDependencies { ipcMain: IpcMainHandlePort; installer: RuntimeInstallerPort; installRoot: string; }

export function registerComfyUiRuntimeIpc(dependencies: RegisterComfyUiRuntimeIpcDependencies): void {
  dependencies.ipcMain.handle(DESKTOP_COMFYUI_INSTALL_STATUS_READ_REQUEST_CHANNEL.value, async (_event, request) => {
    try {
      const value = await dependencies.installer.getInstallStatus({ targetId: "comfyui", installRoot: request.payload.installRoot ?? dependencies.installRoot });
      return createDesktopComfyUiInstallStatusSuccessResponse(value, { requestId: request.requestId, correlationId: request.correlationId });
    } catch (error) {
      return createIpcErrorResponse({ operation: request.operation, channel: request.channel, requestId: request.requestId, correlationId: request.correlationId, error: { code: "desktop.comfyui.status.failed", message: error instanceof Error ? error.message : "Failed" } });
    }
  });

  dependencies.ipcMain.handle(DESKTOP_COMFYUI_INSTALL_REPAIR_REQUEST_CHANNEL.value, async (_event, request) => {
    try {
      const value = await dependencies.installer.repairInstall?.({ targetId: "comfyui", installRoot: request.payload.installRoot ?? dependencies.installRoot, source: { type: "git", repositoryUrl: "https://github.com/Comfy-Org/ComfyUI" }, allowUpdate: request.payload.allowUpdate, forceRepair: request.payload.forceRepair })
      ?? await dependencies.installer.ensureInstalled({ targetId: "comfyui", installRoot: request.payload.installRoot ?? dependencies.installRoot, source: { type: "git", repositoryUrl: "https://github.com/Comfy-Org/ComfyUI" }, allowUpdate: request.payload.allowUpdate, forceRepair: request.payload.forceRepair });
      return createDesktopComfyUiRepairInstallSuccessResponse(value, { requestId: request.requestId, correlationId: request.correlationId });
    } catch (error) {
      return createIpcErrorResponse({ operation: request.operation, channel: request.channel, requestId: request.requestId, correlationId: request.correlationId, error: { code: "desktop.comfyui.repair.failed", message: error instanceof Error ? error.message : "Failed" } });
    }
  });
}
