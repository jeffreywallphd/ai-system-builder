import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../../../infrastructure/config/AppRuntimeConfig";
import {
  LocalStorageUiSettingsStorage,
  UiSettingsStore,
  type UiSettingsStorage,
} from "../../settings/UiSettingsStore";

function createConfig(overrides: Partial<ConstructorParameters<typeof AppRuntimeConfig>[0]> = {}): AppRuntimeConfig {
  return new AppRuntimeConfig({
    workflowRepositoryMode: "memory",
    workflowExecutorMode: "preview",
    nodeCatalogMode: "mock",
    seedStarterNode: true,
    isProductionMode: false,
    devSyncBaseUrl: "http://localhost:8787",
    devSyncToken: "token",
    modelInstallDirectory: "shared/models",
    ...overrides,
  });
}

describe("UiSettingsStore", () => {
  it("defaults workspace data to dev folders in development mode", () => {
    const store = new UiSettingsStore({
      config: createConfig({ isProductionMode: false }),
      storage: { load: () => undefined, save: () => undefined },
    });

    expect(store.getSettings().development.workspaceDataMode).toBe("development");
    expect(store.getSettings().workspace.rootDirectory).toBe("dev/workflow-data");
    expect(store.getSettings().workspace.inputsDirectory).toBe("dev/workflow-data/inputs");
  });

  it("defaults workspace data to user folders in production mode", () => {
    const store = new UiSettingsStore({
      config: createConfig({ isProductionMode: true }),
      storage: { load: () => undefined, save: () => undefined },
    });

    expect(store.getSettings().development.workspaceDataMode).toBe("production");
    expect(store.getSettings().workspace.rootDirectory).toBe("user/workflow-data");
    expect(store.getSettings().workspace.outputsDirectory).toBe("user/workflow-data/outputs");
  });

  it("loads persisted settings on startup and merges them with defaults", () => {
    const storage: UiSettingsStorage = {
      load: () => ({
        workspace: { outputsDirectory: "team/exports" },
        models: { installDirectory: "shared/team-models" },
      }),
      save: () => undefined,
    };

    const store = new UiSettingsStore({ config: createConfig(), storage });

    expect(store.getSettings().workspace.outputsDirectory).toBe("team/exports");
    expect(store.getSettings().workspace.inputsDirectory).toBe("dev/workflow-data/inputs");
    expect(store.getSettings().models.installDirectory).toBe("shared/team-models");
  });

  it("switches workspace data mode and updates the workspace folders together", () => {
    const saved: Array<string> = [];
    const store = new UiSettingsStore({
      config: createConfig(),
      storage: {
        load: () => undefined,
        save: (settings) => {
          saved.push(settings.workspace.rootDirectory);
        },
      },
    });

    store.setWorkspaceDataMode("production");

    expect(store.getSettings().development.workspaceDataMode).toBe("production");
    expect(store.getSettings().workspace.rootDirectory).toBe("user/workflow-data");
    expect(store.getSettings().workspace.workflowsDirectory).toBe("user/workflow-data/workflows");
    expect(saved).toEqual(["user/workflow-data"]);
  });

  it("persists updates immediately when a setting changes", () => {
    const saved: Array<string> = [];
    const storage: UiSettingsStorage = {
      load: () => undefined,
      save: (settings) => {
        saved.push(settings.models.installDirectory);
      },
    };

    const store = new UiSettingsStore({ config: createConfig(), storage });
    store.updateSection("models", { installDirectory: "shared/new-library" });

    expect(store.getSettings().models.installDirectory).toBe("shared/new-library");
    expect(saved).toEqual(["shared/new-library"]);
    expect(store.getState().lastSavedAt).toBeString();
  });

  it("round-trips JSON storage through the local storage adapter", () => {
    const memoryStorage = new Map<string, string>();
    const adapter = new LocalStorageUiSettingsStorage("ui-settings-test", {
      getItem: (key: string) => memoryStorage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memoryStorage.set(key, value);
      },
    });

    const store = new UiSettingsStore({ config: createConfig(), storage: adapter });
    store.updateSection("development", { devSyncBaseUrl: "http://dev-sync.local" });

    expect(adapter.load()?.development?.devSyncBaseUrl).toBe("http://dev-sync.local");
  });
});
