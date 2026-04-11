/**
 * Unit tests covering authentication bootstrap IPC registration, argument validation, and safe error handling semantics.
 */
import { describe, expect, it } from "bun:test";
import type { IpcMain } from "electron";
import {
  DesktopPostLoginWarmupTriggerSources,
  type DesktopAuthBootstrapContext,
} from "../../shared/DesktopContracts";
import {
  AUTH_BOOTSTRAP_IPC_CHANNELS,
  registerAuthBootstrapIpc,
} from "../AuthBootstrapIpcRegistration";

type SyncIpcHandler = (event: { returnValue?: unknown }, ...args: ReadonlyArray<unknown>) => void;
type AsyncIpcHandler = (_event: unknown, ...args: ReadonlyArray<unknown>) => unknown;

function createFakeIpcMain() {
  const onHandlers = new Map<string, SyncIpcHandler>();
  const handleHandlers = new Map<string, AsyncIpcHandler>();
  const ipcMain = {
    on(channel: string, listener: SyncIpcHandler) {
      onHandlers.set(channel, listener);
      return this;
    },
    handle(channel: string, listener: AsyncIpcHandler) {
      handleHandlers.set(channel, listener);
      return this;
    },
  };
  return { ipcMain, onHandlers, handleHandlers };
}

function asIpcMainPort(ipcMain: unknown): Pick<IpcMain, "on" | "handle"> {
  return ipcMain as Pick<IpcMain, "on" | "handle">;
}

describe("registerAuthBootstrapIpc", () => {
  it("registers only auth/bootstrap IPC channels", () => {
    const { ipcMain, onHandlers, handleHandlers } = createFakeIpcMain();

    registerAuthBootstrapIpc({
      ipcMain: asIpcMainPort(ipcMain),
      getBootstrapContext: () => undefined,
      storage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      isDeferredFeatureIpcReady: () => false,
      getPostLoginRuntimeStatus: () => ({
        state: "unavailable",
        unavailableReason: "pre-login",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }),
      startPostLoginWarmup: async () => undefined,
      connectivity: {
        getState: () => "{}",
        setOfflineMode: () => "{}",
      },
      secrets: {
        isAvailable: () => false,
        getSecret: () => null,
        setSecret: () => undefined,
        removeSecret: () => undefined,
      },
    });

    const onChannels = [...onHandlers.keys()].sort();
    const handleChannels = [...handleHandlers.keys()].sort();
    expect(onChannels).toEqual([
      AUTH_BOOTSTRAP_IPC_CHANNELS.bootstrap,
      AUTH_BOOTSTRAP_IPC_CHANNELS.secretsGet,
      AUTH_BOOTSTRAP_IPC_CHANNELS.secretsIsAvailable,
      AUTH_BOOTSTRAP_IPC_CHANNELS.secretsRemove,
      AUTH_BOOTSTRAP_IPC_CHANNELS.secretsSet,
      AUTH_BOOTSTRAP_IPC_CHANNELS.deferredFeatureApiReady,
      AUTH_BOOTSTRAP_IPC_CHANNELS.postLoginRuntimeStatus,
      AUTH_BOOTSTRAP_IPC_CHANNELS.storageGetItem,
      AUTH_BOOTSTRAP_IPC_CHANNELS.storageRemoveItem,
      AUTH_BOOTSTRAP_IPC_CHANNELS.storageSetItem,
    ].sort());
    expect(handleChannels).toEqual([
      AUTH_BOOTSTRAP_IPC_CHANNELS.connectivityGetState,
      AUTH_BOOTSTRAP_IPC_CHANNELS.connectivitySetOfflineMode,
      AUTH_BOOTSTRAP_IPC_CHANNELS.startPostLoginWarmup,
    ].sort());
  });

  it("routes bootstrap, storage, secrets, and connectivity through injected providers", async () => {
    const { ipcMain, onHandlers, handleHandlers } = createFakeIpcMain();
    const operations: string[] = [];
    const storage = new Map<string, string>([["session", "abc123"]]);
    const secrets = new Map<string, string>([["token", "secret-value"]]);

    registerAuthBootstrapIpc({
      ipcMain: asIpcMainPort(ipcMain),
      getBootstrapContext: () => ({ environment: { isPackaged: false } } as DesktopAuthBootstrapContext),
      storage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          operations.push(`storage:set:${key}:${value}`);
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          operations.push(`storage:remove:${key}`);
          storage.delete(key);
        },
      },
      isDeferredFeatureIpcReady: () => true,
      getPostLoginRuntimeStatus: () => ({
        state: "warming",
        activationMode: "auth-success-warmup",
        triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
        updatedAt: "2026-04-10T12:00:00.000Z",
      }),
      startPostLoginWarmup: async (request) => {
        operations.push(`runtime:warmup:start:${request.triggerSource}`);
      },
      connectivity: {
        getState: () => JSON.stringify({ state: "connected" }),
        setOfflineMode: (requestJson: string) => {
          operations.push(`connectivity:set:${requestJson}`);
          return JSON.stringify({ state: "offline" });
        },
      },
      secrets: {
        isAvailable: () => true,
        getSecret: (key: string) => secrets.get(key) ?? null,
        setSecret: (key: string, value: string) => {
          operations.push(`secrets:set:${key}:${value}`);
          secrets.set(key, value);
        },
        removeSecret: (key: string) => {
          operations.push(`secrets:remove:${key}`);
          secrets.delete(key);
        },
      },
    });

    const bootstrapEvent: { returnValue?: unknown } = {};
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.bootstrap)?.(bootstrapEvent);
    expect(bootstrapEvent.returnValue).toEqual({ environment: { isPackaged: false } });

    const storageGetEvent: { returnValue?: unknown } = {};
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.storageGetItem)?.(storageGetEvent, "session");
    expect(storageGetEvent.returnValue).toBe("abc123");

    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.storageSetItem)?.({}, "session", "next");
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.storageRemoveItem)?.({}, "session");
    expect(storage.get("session")).toBeUndefined();

    const secretAvailableEvent: { returnValue?: unknown } = {};
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsIsAvailable)?.(secretAvailableEvent);
    expect(secretAvailableEvent.returnValue).toBe(true);

    const secretGetEvent: { returnValue?: unknown } = {};
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsGet)?.(secretGetEvent, "token");
    expect(secretGetEvent.returnValue).toBe("secret-value");

    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsSet)?.({}, "token", "updated");
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.secretsRemove)?.({}, "token");
    expect(secrets.get("token")).toBeUndefined();

    const deferredReadyEvent: { returnValue?: unknown } = {};
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.deferredFeatureApiReady)?.(deferredReadyEvent);
    expect(deferredReadyEvent.returnValue).toBe(true);
    const runtimeStatusEvent: { returnValue?: unknown } = {};
    onHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.postLoginRuntimeStatus)?.(runtimeStatusEvent);
    expect(runtimeStatusEvent.returnValue).toEqual({
      state: "warming",
      activationMode: "auth-success-warmup",
      triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
      updatedAt: "2026-04-10T12:00:00.000Z",
    });
    await handleHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.startPostLoginWarmup)?.({}, {
      triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
      requestedAt: "2026-04-10T13:00:00.000Z",
    });

    const connectivityState = await handleHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.connectivityGetState)?.({});
    expect(connectivityState).toBe(JSON.stringify({ state: "connected" }));
    const offlineMode = await handleHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.connectivitySetOfflineMode)?.(
      {},
      JSON.stringify({ active: true }),
    );
    expect(offlineMode).toBe(JSON.stringify({ state: "offline" }));
    expect(operations).toEqual([
      "storage:set:session:next",
      "storage:remove:session",
      "secrets:set:token:updated",
      "secrets:remove:token",
      "runtime:warmup:start:explicit-login",
      "connectivity:set:{\"active\":true}",
    ]);
  });

  it("normalizes invalid warmup request payloads to unknown trigger source", async () => {
    const { ipcMain, handleHandlers } = createFakeIpcMain();
    const operations: string[] = [];

    registerAuthBootstrapIpc({
      ipcMain: asIpcMainPort(ipcMain),
      getBootstrapContext: () => undefined,
      storage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      isDeferredFeatureIpcReady: () => false,
      getPostLoginRuntimeStatus: () => ({
        state: "unavailable",
        unavailableReason: "pre-login",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }),
      startPostLoginWarmup: async (request) => {
        operations.push(request.triggerSource);
      },
      connectivity: {
        getState: () => "{}",
        setOfflineMode: () => "{}",
      },
      secrets: {
        isAvailable: () => false,
        getSecret: () => null,
        setSecret: () => undefined,
        removeSecret: () => undefined,
      },
    });

    await handleHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.startPostLoginWarmup)?.({}, {
      triggerSource: "invalid-value",
    });
    expect(operations).toEqual([DesktopPostLoginWarmupTriggerSources.unknown]);
  });

  it("passes through feature-demand trigger source for lazy runtime activation", async () => {
    const { ipcMain, handleHandlers } = createFakeIpcMain();
    const operations: string[] = [];

    registerAuthBootstrapIpc({
      ipcMain: asIpcMainPort(ipcMain),
      getBootstrapContext: () => undefined,
      storage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      isDeferredFeatureIpcReady: () => false,
      getPostLoginRuntimeStatus: () => ({
        state: "unavailable",
        unavailableReason: "pre-login",
        updatedAt: "2026-04-10T00:00:00.000Z",
      }),
      startPostLoginWarmup: async (request) => {
        operations.push(request.triggerSource);
      },
      connectivity: {
        getState: () => "{}",
        setOfflineMode: () => "{}",
      },
      secrets: {
        isAvailable: () => false,
        getSecret: () => null,
        setSecret: () => undefined,
        removeSecret: () => undefined,
      },
    });

    await handleHandlers.get(AUTH_BOOTSTRAP_IPC_CHANNELS.startPostLoginWarmup)?.({}, {
      triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand,
    });
    expect(operations).toEqual([DesktopPostLoginWarmupTriggerSources.featureDemand]);
  });
});
