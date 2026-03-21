import { describe, expect, it } from "bun:test";
import { AppRuntimeModes } from "../../../domain/runtime/AppRuntimeMode";
import { AppRuntimeConfig } from "../AppRuntimeConfig";

describe("AppRuntimeConfig", () => {
  it("returns browser development defaults", () => {
    const config = AppRuntimeConfig.forDevelopment();

    expect(config.runtimeMode).toBe(AppRuntimeModes.browserDevelopment);
    expect(config.workflowRepositoryMode).toBe("filesystem-indexed");
    expect(config.workflowExecutorMode).toBe("strategy");
    expect(config.nodeCatalogMode).toBe("registered");
    expect(config.uiSettingsPersistenceMode).toBe("local-storage");
    expect(config.installedModelCatalogMode).toBe("browser-local-storage");
    expect(config.seedStarterNode).toBe(true);
    expect(config.isProductionMode).toBe(false);
    expect(config.devSyncBaseUrl).toBe("http://192.168.1.100:8787");
    expect(config.devSyncToken).toBe("ai-loom-dev-sync");
    expect(config.isDevSyncEnabled).toBe(true);
    expect(config.modelInstallDirectory).toBe("dev/models");
    expect(config.workflowStorageDirectory).toBe("dev/workflow-data/workflows");
    expect(config.workflowIndexDatabasePath).toBe("dev/workflow-data/workflows/workflow-index.sqlite");
  });

  it("builds desktop production defaults around durable app storage", () => {
    const config = AppRuntimeConfig.forDesktopProduction({
      storage: {
        appDataDirectory: "/tmp/ai-loom",
        storageDirectory: "/tmp/ai-loom/storage",
        databasePath: "/tmp/ai-loom/storage/app.sqlite",
        runtimeDirectory: "/tmp/ai-loom/runtime",
        logsDirectory: "/tmp/ai-loom/logs",
        modelsDirectory: "/tmp/ai-loom/models",
        assetsDirectory: "/tmp/ai-loom/assets",
      },
      pythonRuntime: {
        mode: "packaged-private",
        executablePath: "/tmp/python/bin/python3",
        runtimeRoot: "/tmp/resources/runtime/python/linux-x64",
        workspaceDirectory: "/tmp/ai-loom/runtime",
        manifestPath: "/tmp/resources/runtime/python/linux-x64/manifest.json",
        isAvailable: true,
      },
      serviceSupervisorBaseUrl: "http://127.0.0.1:8790",
      serviceSupervisorPort: 8790,
    });

    expect(config.runtimeMode).toBe(AppRuntimeModes.desktopProduction);
    expect(config.workflowRepositoryMode).toBe("filesystem-indexed");
    expect(config.workflowExecutorMode).toBe("strategy");
    expect(config.nodeCatalogMode).toBe("registered");
    expect(config.uiSettingsPersistenceMode).toBe("desktop-sqlite");
    expect(config.installedModelCatalogMode).toBe("desktop-sqlite");
    expect(config.isProductionMode).toBe(true);
    expect(config.isDesktopHost).toBe(true);
    expect(config.isPackagedDesktopHost).toBe(true);
    expect(config.isDevSyncEnabled).toBe(false);
    expect(config.modelInstallDirectory).toBe("/tmp/ai-loom/models");
  });
});
