import type { IpcMain } from "electron";
import type { DesktopAuthBootstrapContext } from "../shared/DesktopContracts";

export const AUTH_BOOTSTRAP_IPC_CHANNELS = Object.freeze({
  bootstrap: "ai-loom-desktop:get-bootstrap-sync",
  storageGetItem: "ai-loom-desktop-storage:getItem",
  storageSetItem: "ai-loom-desktop-storage:setItem",
  storageRemoveItem: "ai-loom-desktop-storage:removeItem",
  connectivityGetState: "ai-loom-desktop-connectivity:get-state",
  connectivitySetOfflineMode: "ai-loom-desktop-connectivity:set-offline-mode",
  secretsIsAvailable: "ai-loom-desktop-secrets:is-available",
  secretsGet: "ai-loom-desktop-secrets:get",
  secretsSet: "ai-loom-desktop-secrets:set",
  secretsRemove: "ai-loom-desktop-secrets:remove",
});

export type RegisterAuthBootstrapIpcParams = {
  readonly ipcMain: Pick<IpcMain, "on" | "handle">;
  readonly getBootstrapContext: () => DesktopAuthBootstrapContext | undefined;
  readonly storage: {
    readonly getItem: (key: string) => string | null;
    readonly setItem: (key: string, value: string) => void;
    readonly removeItem: (key: string) => void;
  };
  readonly connectivity: {
    readonly getState: () => Promise<string> | string;
    readonly setOfflineMode: (requestJson: string) => Promise<string> | string;
  };
  readonly secrets: {
    readonly isAvailable: () => boolean;
    readonly getSecret: (key: string) => string | null;
    readonly setSecret: (key: string, value: string) => void;
    readonly removeSecret: (key: string) => void;
  };
};

export function registerAuthBootstrapIpc(params: RegisterAuthBootstrapIpcParams): void {
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.bootstrap, (event) => {
    event.returnValue = params.getBootstrapContext();
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.storageGetItem, (event, key: string) => {
    event.returnValue = params.storage.getItem(key);
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.storageSetItem, (_event, key: string, value: string) => {
    params.storage.setItem(key, value);
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.storageRemoveItem, (_event, key: string) => {
    params.storage.removeItem(key);
  });
  params.ipcMain.handle(AUTH_BOOTSTRAP_IPC_CHANNELS.connectivityGetState, () => params.connectivity.getState());
  params.ipcMain.handle(AUTH_BOOTSTRAP_IPC_CHANNELS.connectivitySetOfflineMode, (_event, requestJson: string) => (
    params.connectivity.setOfflineMode(requestJson)
  ));
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsIsAvailable, (event) => {
    event.returnValue = params.secrets.isAvailable();
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsGet, (event, key: string) => {
    event.returnValue = params.secrets.getSecret(key);
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsSet, (_event, key: string, value: string) => {
    params.secrets.setSecret(key, value);
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsRemove, (_event, key: string) => {
    params.secrets.removeSecret(key);
  });
}
