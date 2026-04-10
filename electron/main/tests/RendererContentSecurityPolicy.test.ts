import { describe, expect, it } from "bun:test";
import { createRendererContentSecurityPolicy } from "../RendererContentSecurityPolicy";

describe("createRendererContentSecurityPolicy", () => {
  it("allows renderer dev assets and runtime local APIs for connect-src", () => {
    const policy = createRendererContentSecurityPolicy({
      rendererDevUrl: "http://localhost:5174/",
      runtimeConfig: {
        runtimeMode: "desktop-development",
        hostKind: "desktop",
        lifecycleStage: "development",
        distributionTarget: "electron",
        rendererDeliveryMode: "dev-server",
        workflowRepositoryMode: "filesystem-indexed",
        workflowExecutorMode: "strategy",
        nodeCatalogMode: "registered",
        uiSettingsPersistenceMode: "local-storage",
        installedModelCatalogMode: "browser-local-storage",
        seedStarterNode: true,
        isProductionMode: false,
        modelInstallDirectory: "dev/models",
        identityApiBaseUrl: "http://127.0.0.1:56609",
        serviceSupervisorBaseUrl: "http://127.0.0.1:8790",
        serviceSupervisorPort: 8790,
        pythonRuntimeBaseUrl: "http://127.0.0.1:8100",
      },
    });

    expect(policy).toContain("script-src 'self' 'unsafe-inline' http://localhost:5174 http://127.0.0.1:56609 http://127.0.0.1:8790 http://127.0.0.1:8100");
    expect(policy).toContain("connect-src 'self' http://localhost:5174 http://127.0.0.1:56609 http://127.0.0.1:8790 http://127.0.0.1:8100 ws://localhost:5174 ws://127.0.0.1:56609 ws://127.0.0.1:8790 ws://127.0.0.1:8100");
  });

  it("ignores invalid endpoint inputs", () => {
    const policy = createRendererContentSecurityPolicy({
      rendererDevUrl: "not-a-url",
      runtimeConfig: {
        runtimeMode: "desktop-development",
        hostKind: "desktop",
        lifecycleStage: "development",
        distributionTarget: "electron",
        rendererDeliveryMode: "dev-server",
        workflowRepositoryMode: "filesystem-indexed",
        workflowExecutorMode: "strategy",
        nodeCatalogMode: "registered",
        uiSettingsPersistenceMode: "local-storage",
        installedModelCatalogMode: "browser-local-storage",
        seedStarterNode: true,
        isProductionMode: false,
        modelInstallDirectory: "dev/models",
        identityApiBaseUrl: "://bad",
      },
    });

    expect(policy).toContain("connect-src 'self'");
    expect(policy).not.toContain("://bad");
  });

  it("does not include dev renderer origin for packaged assets mode", () => {
    const policy = createRendererContentSecurityPolicy({
      rendererDevUrl: "http://localhost:5174/",
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
        modelInstallDirectory: "models",
        identityApiBaseUrl: "http://127.0.0.1:56609",
      },
    });

    expect(policy).not.toContain("http://localhost:5174");
    expect(policy).toContain("connect-src 'self' http://127.0.0.1:56609 ws://127.0.0.1:56609");
  });
});
