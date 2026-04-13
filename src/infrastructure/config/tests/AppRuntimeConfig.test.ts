import { describe, expect, it } from "bun:test";
import { AppRuntimeModes } from "@domain/runtime/AppRuntimeMode";
import {
  AppDistributionTargets,
  AppHostKinds,
  AppLifecycleStages,
  RendererDeliveryModes,
} from "@domain/runtime/AppRuntimeProfile";
import { AppRuntimeConfig } from "../AppRuntimeConfig";

describe("AppRuntimeConfig", () => {
  it("returns browser development defaults", () => {
    const config = AppRuntimeConfig.forDevelopment();

    expect(config.runtimeMode).toBe(AppRuntimeModes.browserDevelopment);
    expect(config.hostKind).toBe(AppHostKinds.browser);
    expect(config.lifecycleStage).toBe(AppLifecycleStages.development);
    expect(config.distributionTarget).toBe(AppDistributionTargets.viteBrowser);
    expect(config.rendererDeliveryMode).toBe(RendererDeliveryModes.devServer);
    expect(config.workflowRepositoryMode).toBe("browser-storage");
    expect(config.workflowExecutorMode).toBe("strategy");
    expect(config.nodeCatalogMode).toBe("registered");
    expect(config.uiSettingsPersistenceMode).toBe("local-storage");
    expect(config.installedModelCatalogMode).toBe("browser-local-storage");
    expect(config.seedStarterNode).toBe(true);
    expect(config.isProductionMode).toBe(false);
    expect(config.devSyncBaseUrl).toBe("http://192.168.1.100:8787");
    expect(config.devSyncToken).toBe("ai-loom-dev-sync");
    expect(config.controlPlaneBaseUrl).toBe("http://127.0.0.1:8788");
    expect(config.identityApiBaseUrl).toBe("http://127.0.0.1:8788");
    expect(config.isDevSyncEnabled).toBe(true);
    expect(config.modelInstallDirectory).toBe("dev/models");
    expect(config.workflowStorageDirectory).toBe("dev/workflow-data/workflows");
    expect(config.workflowIndexDatabasePath).toBeUndefined();
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
      pythonRuntimeBaseUrl: "http://127.0.0.1:8100",
    });

    expect(config.runtimeMode).toBe(AppRuntimeModes.desktopProduction);
    expect(config.hostKind).toBe(AppHostKinds.desktop);
    expect(config.lifecycleStage).toBe(AppLifecycleStages.production);
    expect(config.distributionTarget).toBe(AppDistributionTargets.electron);
    expect(config.rendererDeliveryMode).toBe(RendererDeliveryModes.packagedAssets);
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
    expect(config.pythonRuntimeBaseUrl).toBe("http://127.0.0.1:8100");
  });

  it("builds auth-shell desktop runtime config without python and supervisor details", () => {
    const config = AppRuntimeConfig.forDesktopProductionAuthShell({
      storage: {
        appDataDirectory: "/tmp/ai-loom",
        storageDirectory: "/tmp/ai-loom/storage",
        databasePath: "/tmp/ai-loom/storage/app.sqlite",
        runtimeDirectory: "/tmp/ai-loom/runtime",
        logsDirectory: "/tmp/ai-loom/logs",
        modelsDirectory: "/tmp/ai-loom/models",
        assetsDirectory: "/tmp/ai-loom/assets",
      },
      controlPlaneBaseUrl: "http://127.0.0.1:8788",
      controlPlaneCapabilityPhase: "pre-login",
    });

    expect(config.runtimeMode).toBe(AppRuntimeModes.desktopProduction);
    expect(config.modelInstallDirectory).toBe("/tmp/ai-loom/models");
    expect(config.controlPlaneBaseUrl).toBe("http://127.0.0.1:8788");
    expect(config.controlPlaneCapabilityPhase).toBe("pre-login");
    expect(config.identityApiBaseUrl).toBe("http://127.0.0.1:8788");
    expect(config.serviceSupervisorBaseUrl).toBeUndefined();
    expect(config.serviceSupervisorPort).toBeUndefined();
    expect(config.pythonRuntimeBaseUrl).toBeUndefined();
    expect(config.desktopPythonRuntime).toBeUndefined();
  });

  it("reads browser development runtime bootstrap env overrides", () => {
    const globalWithWindow = (globalThis as typeof globalThis & {
      window?: {
        aiLoomBrowserDevelopment?: {
          env?: Record<string, string | undefined>;
        };
      };
    });
    const previousWindow = globalWithWindow.window;

    try {
      globalWithWindow.window = {
        aiLoomBrowserDevelopment: {
          env: {
            VITE_IDENTITY_API_BASE_URL: "http://127.0.0.1:8788",
          },
        },
      };

      const config = AppRuntimeConfig.forDevelopment();
      expect(config.controlPlaneBaseUrl).toBe("http://127.0.0.1:8788");
      expect(config.identityApiBaseUrl).toBe("http://127.0.0.1:8788");
    } finally {
      globalWithWindow.window = previousWindow;
    }
  });

  it("resolves desktop runtime config from auth-minimal bootstrap payload", () => {
    const globalWithDesktop = (globalThis as typeof globalThis & {
      aiLoomDesktop?: {
        auth?: {
          bootstrap?: {
            runtimeConfig: {
              runtimeMode: "desktop-production";
              hostKind: "desktop";
              lifecycleStage: "production";
              distributionTarget: "electron";
              rendererDeliveryMode: "packaged-assets";
              workflowRepositoryMode: "filesystem-indexed";
              workflowExecutorMode: "strategy";
              nodeCatalogMode: "registered";
              uiSettingsPersistenceMode: "desktop-sqlite";
              installedModelCatalogMode: "desktop-sqlite";
              seedStarterNode: false;
              isProductionMode: true;
              controlPlaneBaseUrl: string;
              controlPlaneCapabilityPhase: "pre-login";
              identityApiBaseUrl: string;
              modelInstallDirectory: string;
            };
          };
        };
        bootstrap?: {
          runtimeConfig: {
            runtimeMode: "desktop-production";
            hostKind: "desktop";
            lifecycleStage: "production";
            distributionTarget: "electron";
            rendererDeliveryMode: "packaged-assets";
            workflowRepositoryMode: "filesystem-indexed";
            workflowExecutorMode: "strategy";
            nodeCatalogMode: "registered";
            uiSettingsPersistenceMode: "desktop-sqlite";
            installedModelCatalogMode: "desktop-sqlite";
            seedStarterNode: false;
            isProductionMode: true;
            controlPlaneBaseUrl: string;
            controlPlaneCapabilityPhase: "pre-login";
            identityApiBaseUrl: string;
            modelInstallDirectory: string;
          };
        };
      };
    });
    const previousDesktopBootstrap = globalWithDesktop.aiLoomDesktop;
    try {
      globalWithDesktop.aiLoomDesktop = {
        auth: {
          bootstrap: {
            runtimeConfig: {
              runtimeMode: "desktop-production",
              hostKind: "desktop",
              lifecycleStage: "production",
              distributionTarget: "electron",
              rendererDeliveryMode: "packaged-assets",
              workflowRepositoryMode: "filesystem-indexed",
              workflowExecutorMode: "strategy",
              nodeCatalogMode: "registered",
              uiSettingsPersistenceMode: "desktop-sqlite",
              installedModelCatalogMode: "desktop-sqlite",
              seedStarterNode: false,
              isProductionMode: true,
              controlPlaneBaseUrl: "http://127.0.0.1:8788",
              controlPlaneCapabilityPhase: "pre-login",
              identityApiBaseUrl: "http://127.0.0.1:8788",
              modelInstallDirectory: "/tmp/ai-loom/models",
            },
          },
        },
      };

      const config = AppRuntimeConfig.resolveDefault();
      expect(config.runtimeMode).toBe(AppRuntimeModes.desktopProduction);
      expect(config.controlPlaneBaseUrl).toBe("http://127.0.0.1:8788");
      expect(config.controlPlaneCapabilityPhase).toBe("pre-login");
      expect(config.identityApiBaseUrl).toBe("http://127.0.0.1:8788");
      expect(config.serviceSupervisorBaseUrl).toBeUndefined();
      expect(config.pythonRuntimeBaseUrl).toBeUndefined();
    } finally {
      globalWithDesktop.aiLoomDesktop = previousDesktopBootstrap;
    }
  });

  it("maps legacy desktop bootstrap identityApiBaseUrl to control-plane base URL", () => {
    const config = AppRuntimeConfig.fromValues({
      runtimeMode: "desktop-production",
      hostKind: "desktop",
      lifecycleStage: "production",
      distributionTarget: "electron",
      rendererDeliveryMode: "packaged-assets",
      workflowRepositoryMode: "filesystem-indexed",
      workflowExecutorMode: "strategy",
      nodeCatalogMode: "registered",
      uiSettingsPersistenceMode: "desktop-sqlite",
      installedModelCatalogMode: "desktop-sqlite",
      seedStarterNode: false,
      isProductionMode: true,
      identityApiBaseUrl: "http://127.0.0.1:8788",
      modelInstallDirectory: "/tmp/ai-loom/models",
    });

    expect(config.controlPlaneBaseUrl).toBe("http://127.0.0.1:8788");
    expect(config.identityApiBaseUrl).toBe("http://127.0.0.1:8788");
  });

  it("prefers explicit bootstrapContext when resolving desktop runtime defaults", () => {
    const globalWithDesktop = (globalThis as typeof globalThis & {
      aiLoomDesktop?: {
        auth?: {
          bootstrapContext?: {
            runtimeConfig: {
              runtimeMode: "desktop-production";
              hostKind: "desktop";
              lifecycleStage: "production";
              distributionTarget: "electron";
              rendererDeliveryMode: "packaged-assets";
              workflowRepositoryMode: "filesystem-indexed";
              workflowExecutorMode: "strategy";
              nodeCatalogMode: "registered";
              uiSettingsPersistenceMode: "desktop-sqlite";
              installedModelCatalogMode: "desktop-sqlite";
              seedStarterNode: false;
              isProductionMode: true;
              controlPlaneBaseUrl: string;
              controlPlaneCapabilityPhase: "pre-login";
              identityApiBaseUrl: string;
              modelInstallDirectory: string;
            };
          };
        };
      };
    });
    const previousDesktopBootstrap = globalWithDesktop.aiLoomDesktop;
    try {
      globalWithDesktop.aiLoomDesktop = {
        auth: {
          bootstrapContext: {
            runtimeConfig: {
              runtimeMode: "desktop-production",
              hostKind: "desktop",
              lifecycleStage: "production",
              distributionTarget: "electron",
              rendererDeliveryMode: "packaged-assets",
              workflowRepositoryMode: "filesystem-indexed",
              workflowExecutorMode: "strategy",
              nodeCatalogMode: "registered",
              uiSettingsPersistenceMode: "desktop-sqlite",
              installedModelCatalogMode: "desktop-sqlite",
              seedStarterNode: false,
              isProductionMode: true,
              controlPlaneBaseUrl: "http://127.0.0.1:9001",
              controlPlaneCapabilityPhase: "pre-login",
              identityApiBaseUrl: "http://127.0.0.1:9001",
              modelInstallDirectory: "/tmp/ai-loom/models",
            },
          },
        },
      };

      const config = AppRuntimeConfig.resolveDefault();
      expect(config.controlPlaneBaseUrl).toBe("http://127.0.0.1:9001");
      expect(config.identityApiBaseUrl).toBe("http://127.0.0.1:9001");
    } finally {
      globalWithDesktop.aiLoomDesktop = previousDesktopBootstrap;
    }
  });
});
