/**
 * Registers authentication bootstrap IPC channels required to initialize renderer auth state and session metadata.
 */
import type { IpcMain } from "electron";
import {
  DesktopPostLoginWarmupTriggerSources,
  type DesktopAuthBootstrapContext,
  type DesktopPostLoginRuntimeStatus,
  type DesktopPostLoginWarmupRequest,
} from "../shared/DesktopContracts";
import { DesktopBootstrapIpcChannels } from "../shared/DesktopBootstrapIpcChannels";

export const AUTH_BOOTSTRAP_IPC_CHANNELS = DesktopBootstrapIpcChannels;

export type RegisterAuthBootstrapIpcParams = {
  readonly ipcMain: Pick<IpcMain, "on" | "handle">;
  readonly getBootstrapContext: () => DesktopAuthBootstrapContext | undefined;
  readonly storage: {
    readonly getItem: (key: string) => string | null;
    readonly setItem: (key: string, value: string) => void;
    readonly removeItem: (key: string) => void;
  };
  readonly isDeferredFeatureIpcReady: () => boolean;
  readonly getPostLoginRuntimeStatus: () => DesktopPostLoginRuntimeStatus;
  readonly startPostLoginWarmup: (request: DesktopPostLoginWarmupRequest) => Promise<void>;
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

function parsePostLoginWarmupRequest(value: unknown): DesktopPostLoginWarmupRequest {
  if (typeof value !== "object" || value === null) {
    return Object.freeze({ triggerSource: DesktopPostLoginWarmupTriggerSources.unknown });
  }
  const request = value as {
    readonly triggerSource?: unknown;
    readonly requestedAt?: unknown;
  };
  const requestedAt = typeof request.requestedAt === "string" ? request.requestedAt : undefined;
  const triggerSource = request.triggerSource;
  if (
    triggerSource === DesktopPostLoginWarmupTriggerSources.explicitLogin
    || triggerSource === DesktopPostLoginWarmupTriggerSources.sessionRestore
    || triggerSource === DesktopPostLoginWarmupTriggerSources.sessionRefresh
    || triggerSource === DesktopPostLoginWarmupTriggerSources.featureDemand
    || triggerSource === DesktopPostLoginWarmupTriggerSources.unknown
  ) {
    return Object.freeze({
      triggerSource,
      requestedAt,
    });
  }
  return Object.freeze({
    triggerSource: DesktopPostLoginWarmupTriggerSources.unknown,
    requestedAt,
  });
}

export function registerAuthBootstrapIpc(params: RegisterAuthBootstrapIpcParams): void {
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.bootstrap, (event) => {
    event.returnValue = params.getBootstrapContext();
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.storageGetItem, (event, key: string) => {
    event.returnValue = params.storage.getItem(key);
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.storageSetItem, (event, key: string, value: string) => {
    params.storage.setItem(key, value);
    event.returnValue = true;
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.storageRemoveItem, (event, key: string) => {
    params.storage.removeItem(key);
    event.returnValue = true;
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.deferredFeatureApiReady, (event) => {
    event.returnValue = params.isDeferredFeatureIpcReady();
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.postLoginRuntimeStatus, (event) => {
    event.returnValue = params.getPostLoginRuntimeStatus();
  });
  params.ipcMain.handle(AUTH_BOOTSTRAP_IPC_CHANNELS.startPostLoginWarmup, async (_event, request?: unknown) => {
    await params.startPostLoginWarmup(parsePostLoginWarmupRequest(request));
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
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsSet, (event, key: string, value: string) => {
    params.secrets.setSecret(key, value);
    event.returnValue = true;
  });
  params.ipcMain.on(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsRemove, (event, key: string) => {
    params.secrets.removeSecret(key);
    event.returnValue = true;
  });
}
