import { describe, expect, it } from "bun:test";
import type { DesktopPostLoginWarmupRequest } from "../../shared/DesktopContracts";
import { DesktopPostLoginWarmupTriggerSources } from "../../shared/DesktopContracts";
import { createPostLoginRuntimeActivationService } from "../runtime/PostLoginRuntimeActivationService";
import type { AuthShellBootstrapResult } from "../runtime/PostLoginRuntimeDependencyActivator";

function createWarmupRequest(overrides?: Partial<DesktopPostLoginWarmupRequest>): DesktopPostLoginWarmupRequest {
  return Object.freeze({
    triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin,
    requestedAt: "2026-04-13T12:00:00.000Z",
    ...overrides,
  });
}

describe("PostLoginRuntimeActivationService", () => {
  it("activates control-plane capabilities and runtime dependencies on first warmup request", async () => {
    const operations: string[] = [];
    const authShell: AuthShellBootstrapResult = Object.freeze({
      storagePaths: {
        appDataDirectory: "app",
        storageDirectory: "storage",
        databasePath: "db",
        runtimeDirectory: "runtime",
        logsDirectory: "logs",
        modelsDirectory: "models",
        assetsDirectory: "assets",
      },
      controlPlaneBaseUrl: "http://127.0.0.1:8111",
    });

    const controlPlaneRuntime = {
      address: "127.0.0.1:8111",
      activateCapabilities: () => {
        operations.push("control-plane:activate-capabilities");
      },
    } as const;

    const service = createPostLoginRuntimeActivationService({
      postLoginRuntimeStatusStore: {
        markWarming: () => operations.push("status:warming"),
        markFailed: () => operations.push("status:failed"),
      } as never,
      connectivityRuntimeController: {
        startMonitoring: (baseUrl: string) => {
          operations.push(`connectivity:start:${baseUrl}`);
        },
      } as never,
      getAuthShellBootstrapResult: () => authShell,
      getControlPlaneServerRuntime: () => controlPlaneRuntime as never,
      activateRuntimeDependencies: async () => {
        operations.push("dependencies:activate");
      },
      disposeDesktopRuntimeResources: async () => {
        operations.push("runtime:dispose");
      },
      isDesktopRuntimeDisposing: () => false,
      exitProcess: () => {
        throw new Error("exit should not be called");
      },
    });

    await service.startPostLoginWarmup(createWarmupRequest());

    expect(operations).toEqual([
      "control-plane:activate-capabilities",
      "status:warming",
      "connectivity:start:http://127.0.0.1:8111",
      "dependencies:activate",
    ]);
  });

  it("joins in-flight activation and avoids duplicate dependency activation", async () => {
    const operations: string[] = [];
    let resolveActivation: (() => void) | undefined;
    const pendingActivation = new Promise<void>((resolve) => {
      resolveActivation = resolve;
    });

    const service = createPostLoginRuntimeActivationService({
      postLoginRuntimeStatusStore: {
        markWarming: () => operations.push("status:warming"),
        markFailed: () => operations.push("status:failed"),
      } as never,
      connectivityRuntimeController: {
        startMonitoring: () => operations.push("connectivity:start"),
      } as never,
      getAuthShellBootstrapResult: () => Object.freeze({
        storagePaths: {
          appDataDirectory: "app",
          storageDirectory: "storage",
          databasePath: "db",
          runtimeDirectory: "runtime",
          logsDirectory: "logs",
          modelsDirectory: "models",
          assetsDirectory: "assets",
        },
        controlPlaneBaseUrl: "http://127.0.0.1:8111",
      }),
      getControlPlaneServerRuntime: () => ({
        address: "127.0.0.1:8111",
        activateCapabilities: () => operations.push("control-plane:activate-capabilities"),
      }) as never,
      activateRuntimeDependencies: async () => {
        operations.push("dependencies:activate");
        await pendingActivation;
      },
      disposeDesktopRuntimeResources: async () => {
        operations.push("runtime:dispose");
      },
      isDesktopRuntimeDisposing: () => false,
      exitProcess: () => {
        throw new Error("exit should not be called");
      },
    });

    const first = service.startPostLoginWarmup(createWarmupRequest());
    const second = service.startPostLoginWarmup(createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.sessionRestore }));

    resolveActivation?.();
    await Promise.all([first, second]);

    expect(operations.filter((entry) => entry === "dependencies:activate")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "status:warming")).toHaveLength(1);
  });

  it("joins concurrent activation requests across login, restore, refresh, and feature-demand triggers", async () => {
    const operations: string[] = [];
    let resolveActivation: (() => void) | undefined;
    const pendingActivation = new Promise<void>((resolve) => {
      resolveActivation = resolve;
    });

    const service = createPostLoginRuntimeActivationService({
      postLoginRuntimeStatusStore: {
        markWarming: () => operations.push("status:warming"),
        markFailed: () => operations.push("status:failed"),
      } as never,
      connectivityRuntimeController: {
        startMonitoring: () => operations.push("connectivity:start"),
      } as never,
      getAuthShellBootstrapResult: () => Object.freeze({
        storagePaths: {
          appDataDirectory: "app",
          storageDirectory: "storage",
          databasePath: "db",
          runtimeDirectory: "runtime",
          logsDirectory: "logs",
          modelsDirectory: "models",
          assetsDirectory: "assets",
        },
        controlPlaneBaseUrl: "http://127.0.0.1:8111",
      }),
      getControlPlaneServerRuntime: () => ({
        address: "127.0.0.1:8111",
        activateCapabilities: () => operations.push("control-plane:activate-capabilities"),
      }) as never,
      activateRuntimeDependencies: async () => {
        operations.push("dependencies:activate");
        await pendingActivation;
      },
      disposeDesktopRuntimeResources: async () => {
        operations.push("runtime:dispose");
      },
      isDesktopRuntimeDisposing: () => false,
      exitProcess: () => {
        throw new Error("exit should not be called");
      },
    });

    const requests = [
      createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin }),
      createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.sessionRestore }),
      createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.sessionRefresh }),
      createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand }),
    ];
    const activations = requests.map((request) => service.startPostLoginWarmup(request));

    resolveActivation?.();
    await Promise.all(activations);

    expect(operations.filter((entry) => entry === "dependencies:activate")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "control-plane:activate-capabilities")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "status:warming")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "connectivity:start")).toHaveLength(1);
  });

  it("is idempotent after readiness and ignores repeated activation requests", async () => {
    const operations: string[] = [];

    const service = createPostLoginRuntimeActivationService({
      postLoginRuntimeStatusStore: {
        markWarming: () => operations.push("status:warming"),
        markFailed: () => operations.push("status:failed"),
      } as never,
      connectivityRuntimeController: {
        startMonitoring: () => operations.push("connectivity:start"),
      } as never,
      getAuthShellBootstrapResult: () => Object.freeze({
        storagePaths: {
          appDataDirectory: "app",
          storageDirectory: "storage",
          databasePath: "db",
          runtimeDirectory: "runtime",
          logsDirectory: "logs",
          modelsDirectory: "models",
          assetsDirectory: "assets",
        },
        controlPlaneBaseUrl: "http://127.0.0.1:8111",
      }),
      getControlPlaneServerRuntime: () => ({
        address: "127.0.0.1:8111",
        activateCapabilities: () => operations.push("control-plane:activate-capabilities"),
      }) as never,
      activateRuntimeDependencies: async () => {
        operations.push("dependencies:activate");
      },
      disposeDesktopRuntimeResources: async () => {
        operations.push("runtime:dispose");
      },
      isDesktopRuntimeDisposing: () => false,
      exitProcess: () => {
        throw new Error("exit should not be called");
      },
    });

    await service.startPostLoginWarmup(createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.explicitLogin }));
    await service.startPostLoginWarmup(createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.sessionRefresh }));
    await service.startPostLoginWarmup(createWarmupRequest({ triggerSource: DesktopPostLoginWarmupTriggerSources.featureDemand }));

    expect(operations.filter((entry) => entry === "dependencies:activate")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "control-plane:activate-capabilities")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "status:warming")).toHaveLength(1);
    expect(operations.filter((entry) => entry === "connectivity:start")).toHaveLength(1);
  });

  it("marks failure and resets activation state when dependency activation fails", async () => {
    const operations: string[] = [];
    const failure = new Error("runtime activation failed");

    const service = createPostLoginRuntimeActivationService({
      postLoginRuntimeStatusStore: {
        markWarming: () => operations.push("status:warming"),
        markFailed: () => operations.push("status:failed"),
      } as never,
      connectivityRuntimeController: {
        startMonitoring: () => operations.push("connectivity:start"),
      } as never,
      getAuthShellBootstrapResult: () => Object.freeze({
        storagePaths: {
          appDataDirectory: "app",
          storageDirectory: "storage",
          databasePath: "db",
          runtimeDirectory: "runtime",
          logsDirectory: "logs",
          modelsDirectory: "models",
          assetsDirectory: "assets",
        },
        controlPlaneBaseUrl: "http://127.0.0.1:8111",
      }),
      getControlPlaneServerRuntime: () => ({
        address: "127.0.0.1:8111",
        activateCapabilities: () => operations.push("control-plane:activate-capabilities"),
      }) as never,
      activateRuntimeDependencies: async () => {
        operations.push("dependencies:activate");
        throw failure;
      },
      disposeDesktopRuntimeResources: async () => {
        operations.push("runtime:dispose");
      },
      isDesktopRuntimeDisposing: () => true,
      exitProcess: () => {
        operations.push("process:exit");
      },
    });

    await expect(service.startPostLoginWarmup(createWarmupRequest())).rejects.toThrow("runtime activation failed");

    await expect(service.startPostLoginWarmup(createWarmupRequest())).rejects.toThrow("runtime activation failed");
    expect(operations.filter((entry) => entry === "dependencies:activate")).toHaveLength(2);
    expect(operations.filter((entry) => entry === "status:failed")).toHaveLength(2);
    expect(operations).not.toContain("runtime:dispose");
    expect(operations).not.toContain("process:exit");
  });
});
