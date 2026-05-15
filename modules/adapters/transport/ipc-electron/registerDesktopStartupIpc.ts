import { registerRuntimeReadinessIpc } from "./runtime-readiness/registerRuntimeReadinessIpc";
import { registerPythonRuntimeIpc, type PythonRuntimeControlPort } from "./python-runtime/registerPythonRuntimeIpc";
import { registerApplicationSettingsIpc } from "./settings/registerApplicationSettingsIpc";
import { registerWorkspaceIpc, type RegisterWorkspaceIpcDependencies } from "./workspace/registerWorkspaceIpc";
import type { IpcMainHandlePort } from "./ipcMainHandlePort";

export interface RegisterDesktopStartupIpcDependencies {
  ipcMain: IpcMainHandlePort;
  pythonRuntime: PythonRuntimeControlPort;
  runtimeReadiness: any;
  workspaceServices?: Omit<RegisterWorkspaceIpcDependencies, "ipcMain">;
  settingsUseCases: any;
}

export function registerDesktopStartupIpc(dependencies: RegisterDesktopStartupIpcDependencies): void {
  registerRuntimeReadinessIpc({ ipcMain: dependencies.ipcMain, runtimeReadiness: dependencies.runtimeReadiness });
  if (dependencies.workspaceServices) registerWorkspaceIpc({ ipcMain: dependencies.ipcMain, ...dependencies.workspaceServices });
  registerApplicationSettingsIpc({ ipcMain: dependencies.ipcMain, ...dependencies.settingsUseCases });
  registerPythonRuntimeIpc({ ipcMain: dependencies.ipcMain, ...dependencies.pythonRuntime });
}
