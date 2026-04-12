import type { SystemStudioBackendApi } from "../../../src/infrastructure/api/system-studio/SystemStudioBackendApi";
import type { SystemStudioIpcRegistrationParams } from "./IpcRegistrationTypes";

export function registerSystemStudioIpc(params: SystemStudioIpcRegistrationParams): void {
  const { ipcMain, onDemand } = params;
  const getSystemStudioBackendApi = () => onDemand.getSystemStudioBackendApi();

  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:list", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["listChildComponents"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().listChildComponents(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:add", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["addChildComponent"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().addChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:remove", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["removeChildComponent"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().removeChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-components:reorder", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["reorderChildComponent"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().reorderChildComponent(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-interfaces:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateInterfaces"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().updateInterfaces(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-parameters:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateParameters"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().updateParameters(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-execution-metadata:update", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["updateExecutionMetadata"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().updateExecutionMetadata(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:save", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["saveSystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().saveSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:load", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["loadSystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().loadSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:duplicate", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["duplicateSystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().duplicateSystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-definition:modify", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["modifySystemDefinition"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().modifySystemDefinition(request));
  });
  ipcMain.handle("ai-loom-desktop-studio-shell:system-compatibility:insights", async (_event, requestJson: string) => {
    const request = JSON.parse(requestJson) as Parameters<SystemStudioBackendApi["getCompatibilityInsights"]>[0];
    return JSON.stringify(await getSystemStudioBackendApi().getCompatibilityInsights(request));
  });
}
