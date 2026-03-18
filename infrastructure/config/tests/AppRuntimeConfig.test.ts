import { describe, expect, it } from "bun:test";
import { AppRuntimeConfig } from "../AppRuntimeConfig";

describe("AppRuntimeConfig", () => {
  it("returns development defaults", () => {
    const config = AppRuntimeConfig.forDevelopment();

    expect(config.workflowRepositoryMode).toBe("memory");
    expect(config.workflowExecutorMode).toBe("preview");
    expect(config.nodeCatalogMode).toBe("mock");
    expect(config.seedStarterNode).toBe(true);
    expect(config.isProductionMode).toBe(false);
    expect(config.devSyncBaseUrl).toBe("http://192.168.1.100:8787");
    expect(config.devSyncToken).toBe("ai-loom-dev-sync");
    expect(config.isDevSyncEnabled).toBe(true);
    expect(config.modelInstallDirectory).toBe("dev/models");
  });


  it("reads development defaults from environment variables when available", () => {
    const originalBaseUrl = process.env.VITE_DEV_SYNC_BASE_URL;
    const originalToken = process.env.VITE_DEV_SYNC_TOKEN;
    const originalModelDirectory = process.env.VITE_MODEL_INSTALL_DIRECTORY;

    process.env.VITE_DEV_SYNC_BASE_URL = "http://localhost:9999";
    process.env.VITE_DEV_SYNC_TOKEN = "custom-token";
    process.env.VITE_MODEL_INSTALL_DIRECTORY = "dev/custom-model-files";

    const config = AppRuntimeConfig.forDevelopment();

    expect(config.devSyncBaseUrl).toBe("http://localhost:9999");
    expect(config.devSyncToken).toBe("custom-token");
    expect(config.modelInstallDirectory).toBe("dev/custom-model-files");

    if (typeof originalBaseUrl === "undefined") {
      delete process.env.VITE_DEV_SYNC_BASE_URL;
    } else {
      process.env.VITE_DEV_SYNC_BASE_URL = originalBaseUrl;
    }

    if (typeof originalToken === "undefined") {
      delete process.env.VITE_DEV_SYNC_TOKEN;
    } else {
      process.env.VITE_DEV_SYNC_TOKEN = originalToken;
    }

    if (typeof originalModelDirectory === "undefined") {
      delete process.env.VITE_MODEL_INSTALL_DIRECTORY;
    } else {
      process.env.VITE_MODEL_INSTALL_DIRECTORY = originalModelDirectory;
    }
  });

  it("normalizes optional dev sync values", () => {
    const config = new AppRuntimeConfig({
      workflowRepositoryMode: "memory",
      workflowExecutorMode: "preview",
      nodeCatalogMode: "mock",
      seedStarterNode: false,
      isProductionMode: false,
      devSyncBaseUrl: "   ",
      devSyncToken: "  token-123  ",
      modelInstallDirectory: "  dev/test-models  ",
    });

    expect(config.devSyncBaseUrl).toBeUndefined();
    expect(config.devSyncToken).toBe("token-123");
    expect(config.isDevSyncEnabled).toBe(false);
    expect(config.modelInstallDirectory).toBe("dev/test-models");
  });

  it("disables dev sync in production even when base url is present", () => {
    const config = new AppRuntimeConfig({
      workflowRepositoryMode: "memory",
      workflowExecutorMode: "preview",
      nodeCatalogMode: "mock",
      seedStarterNode: false,
      isProductionMode: true,
      devSyncBaseUrl: "http://localhost:8787",
      modelInstallDirectory: "dev/prod-models",
    });

    expect(config.isDevSyncEnabled).toBe(false);
  });
});
