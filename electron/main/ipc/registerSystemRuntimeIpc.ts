import type { SystemRuntimeBackendApi } from "../../../src/infrastructure/api/system-runtime/SystemRuntimeBackendApi";
import type { SystemRuntimeIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerSystemRuntimeIpc(params: SystemRuntimeIpcRegistrationParams): void {
  const { ipcMain, onDemand, launchRuntimeWindowFromContract } = params;
  const getSystemRuntimeBackendApi = () => onDemand.getSystemRuntimeBackendApi();

  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:start", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemRuntimeBackendApi["startExecution"]>[0];
    return JSON.stringify(await getSystemRuntimeBackendApi().startExecution(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:status", async (_event, executionId: string) => {
    return JSON.stringify(await getSystemRuntimeBackendApi().getExecutionStatus(executionId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:trace", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemRuntimeBackendApi["getExecutionTrace"]>[0];
    return JSON.stringify(await getSystemRuntimeBackendApi().getExecutionTrace(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-runtime:result", async (_event, executionId: string) => {
    return JSON.stringify(await getSystemRuntimeBackendApi().getExecutionResult(executionId));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:runtime-window:launch", async (_event, requestJson: string) => {
    try {
      const request = JSON.parse(requestJson) as { readonly launchContract?: unknown };
      if (!request.launchContract) {
        throw new Error("invalid-request:launchContract is required.");
      }
      const launchContractJson = JSON.stringify(request.launchContract);
      const launched = await launchRuntimeWindowFromContract(launchContractJson);
      return JSON.stringify({
        ok: true,
        data: launched,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Runtime window launch failed.";
      const isInvalid = message.startsWith("invalid-request:");
      return JSON.stringify({
        ok: false,
        error: {
          code: isInvalid ? "invalid-request" : "internal",
          message: isInvalid ? message.slice("invalid-request:".length) : message,
        },
      });
    }
  });
}
