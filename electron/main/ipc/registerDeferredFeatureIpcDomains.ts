import { DesktopStartupPhases } from "../DesktopStartupContract";
import { logInitializationMemory } from "../InitializationLogging";
import type { DeferredFeatureIpcRegistrationParams } from "./IpcRegistrationTypes";
import { registerAgentStudioIpc } from "./registerAgentStudioIpc";
import { registerCanonicalRegistryIpc } from "./registerCanonicalRegistryIpc";
import { registerExecutionRunIpc } from "./registerExecutionRunIpc";
import { registerModelFileIpc } from "./registerModelFileIpc";
import { registerStudioShellIpc } from "./registerStudioShellIpc";
import { registerSystemRuntimeIpc } from "./registerSystemRuntimeIpc";
import { registerSystemStudioIpc } from "./registerSystemStudioIpc";
import { registerWorkflowPersistenceIpc } from "./registerWorkflowPersistenceIpc";
import { registerWorkflowRunHistoryIpc } from "./registerWorkflowRunHistoryIpc";

export function registerDeferredFeatureIpcDomains(params: DeferredFeatureIpcRegistrationParams): void {
  registerWorkflowPersistenceIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
  registerExecutionRunIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
  registerWorkflowRunHistoryIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
  registerAgentStudioIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
  registerStudioShellIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
  registerSystemStudioIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
  registerSystemRuntimeIpc({
    ipcMain: params.ipcMain,
    onDemand: params.onDemand,
    launchRuntimeWindowFromContract: params.launchRuntimeWindowFromContract,
  });
  registerModelFileIpc({ ipcMain: params.ipcMain, storagePaths: params.storagePaths });
  logInitializationMemory(DesktopStartupPhases.postLoginWarmup, "ipc-and-api-bindings-ready");
  registerCanonicalRegistryIpc({ ipcMain: params.ipcMain, onDemand: params.onDemand });
}
