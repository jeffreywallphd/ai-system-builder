// @vitest-environment jsdom
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "../../../../../modules/testing/node-test";

import { ArtifactsPage } from "../pages/ArtifactsPage";
import { AssetLibraryPage } from "../pages/AssetLibraryPage";
import { ImageGenerationPage } from "../pages/ImageGenerationPage";
import { ModelsPage } from "../pages/ModelsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { SystemPage } from "../pages/SystemPage";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).Event = dom.window.Event;
(globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
(globalThis as any).HTMLSelectElement = dom.window.HTMLSelectElement;
(globalThis as any).InputEvent = dom.window.InputEvent;
(globalThis as any).FormData = dom.window.FormData;
(globalThis as any).Blob = dom.window.Blob;
(globalThis as any).URL = dom.window.URL;
(globalThis as any).localStorage = dom.window.localStorage;
(globalThis as any).sessionStorage = dom.window.sessionStorage;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type DesktopApiMock = Record<string, ReturnType<typeof vi.fn> | boolean>;

function envelope(value: unknown) {
  return { ok: true, value };
}

function createDesktopApiMock(): DesktopApiMock {
  return {
    memoryDiagnosticsEnabled: false,
    listModels: vi.fn().mockResolvedValue(envelope({ models: [] })),
    browseModels: vi.fn().mockResolvedValue(envelope({ models: [] })),
    trainModel: vi.fn().mockResolvedValue(envelope({ runId: "r1", status: "queued" })),
    readModelTrainingStatus: vi.fn().mockResolvedValue(envelope({ runId: "r1", status: "succeeded" })),
    validateModel: vi.fn().mockResolvedValue(envelope({ status: "valid" })),
    publishModel: vi.fn().mockResolvedValue(envelope({ published: true })),
    downloadModel: vi.fn().mockResolvedValue(envelope({ model: {}, download: {} })),
    saveModelReference: vi.fn().mockResolvedValue(envelope({ model: {} })),
    getModelDetails: vi.fn().mockResolvedValue(envelope({ model: {} })),
    deleteModelRecord: vi.fn().mockResolvedValue(envelope({ deletedModelRecordId: "m1" })),
    browseArtifacts: vi.fn().mockResolvedValue(envelope({ items: [] })),
    browseUnregisteredArtifacts: vi.fn().mockResolvedValue(envelope({ items: [] })),
    readArtifactDetail: vi.fn().mockResolvedValue(envelope({ locator: { storageKey: "uploads/a.txt" } })),
    readArtifactContentDescriptor: vi.fn().mockResolvedValue(envelope({ availability: "available" })),
    readArtifactMedia: vi.fn().mockResolvedValue({ mediaType: "text/plain", bytes: new Uint8Array() }),
    createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:preview"),
    getHuggingFaceTokenStatus: vi.fn().mockResolvedValue(envelope({ configured: false })),
    publishArtifactToRepo: vi.fn().mockResolvedValue(envelope({})),
    localizeArtifactFromRepo: vi.fn().mockResolvedValue(envelope({})),
    registerArtifactFromRepo: vi.fn().mockResolvedValue(envelope({})),
    browseHuggingFaceNamespaceDatasets: vi.fn().mockResolvedValue(envelope({ datasets: [] })),
    browseHuggingFaceDatasetParquetFiles: vi.fn().mockResolvedValue(envelope({ files: [] })),
    uploadArtifact: vi.fn().mockResolvedValue(envelope({})),
    getArtifactUploadPolicy: vi.fn().mockResolvedValue(envelope({ maxFileSizeBytes: 1_000_000, allowedMediaTypes: [] })),
    ingestWebsitePage: vi.fn().mockResolvedValue(envelope({})),
    ingestWebsitePagesBatch: vi.fn().mockResolvedValue(envelope({})),
    listAssetDefinitions: vi.fn().mockResolvedValue(envelope({ items: [] })),
    readAssetDefinition: vi.fn().mockResolvedValue(envelope({})),
    readAssetDefinitionVersion: vi.fn().mockResolvedValue(envelope({})),
    listAssetResourceBackedViews: vi.fn().mockResolvedValue(envelope({ items: [] })),
    readAssetResourceBackedView: vi.fn().mockResolvedValue(envelope({})),
    registerResourceBackedViewAsAsset: vi.fn().mockResolvedValue(envelope({})),
    finalizeGeneratedOutputAsAsset: vi.fn().mockResolvedValue(envelope({})),
    importExternalRepositoryObjectAsAsset: vi.fn().mockResolvedValue(envelope({})),
    localizeExternalRepositoryObjectAsAsset: vi.fn().mockResolvedValue(envelope({})),
    listApplicationSettingDefinitions: vi.fn().mockResolvedValue(envelope({ definitions: [] })),
    readApplicationSettings: vi.fn().mockResolvedValue(envelope({ values: [] })),
    updateApplicationSetting: vi.fn().mockResolvedValue(envelope({})),
    clearApplicationSetting: vi.fn().mockResolvedValue(envelope({})),
    readPythonRuntimeStatus: vi.fn().mockResolvedValue(envelope({ supervisorStatus: "stopped", runtimeStatus: "stopped", healthy: false, capabilities: [], activeTaskCount: 0, loadedModels: [], logs: [] })),
    controlPythonRuntime: vi.fn().mockResolvedValue(envelope({ supervisorStatus: "stopped", runtimeStatus: "stopped", healthy: false, capabilities: [], activeTaskCount: 0, loadedModels: [], logs: [] })),
    startImageGeneration: vi.fn().mockResolvedValue(envelope({ requestId: "img1" })),
    readImageGeneration: vi.fn().mockResolvedValue(envelope({ status: "succeeded", outputs: [] })),
    finalizeImageGenerationIfCompleted: vi.fn().mockResolvedValue(envelope({ assets: [] })),
    cancelImageGeneration: vi.fn().mockResolvedValue(envelope({ cancelled: true })),
    readComfyUiInstallStatus: vi.fn().mockResolvedValue(envelope({ targetId: "comfyui", status: "installed" })),
    repairComfyUiInstall: vi.fn().mockResolvedValue(envelope({ targetId: "comfyui", status: "installed" })),
  };
}

async function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(ui);
  });
  return { root, container };
}

describe("desktop page section loading", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
    delete window.desktopApi;
  });

  async function mount(ui: React.ReactElement, api = createDesktopApiMock()) {
    window.desktopApi = api as never;
    const mounted = await render(ui);
    root = mounted.root;
    container = mounted.container;
    return { ...mounted, api };
  }

  it("renders the Models shell without remote browse, training, validation, or publish calls", async () => {
    const { container: c, api } = await mount(<ModelsPage workspaceId="w1" workspaceName="Workspace" />);
    expect(c.textContent).toContain("Model Management");
    expect(api.listModels).toHaveBeenCalled();
    expect(api.browseModels).not.toHaveBeenCalled();
    expect(api.trainModel).not.toHaveBeenCalled();
    expect(api.validateModel).not.toHaveBeenCalled();
    expect(api.publishModel).not.toHaveBeenCalled();
  });

  it("renders Image Generation shell without starting Python, ComfyUI, or device detection", async () => {
    const { container: c, api } = await mount(<ImageGenerationPage workspaceId="w1" workspaceName="Workspace" />);
    expect(c.textContent).toContain("Image Generation");
    expect(c.textContent).toContain("Runtime readiness");
    expect(api.startImageGeneration).not.toHaveBeenCalled();
    expect(api.readComfyUiInstallStatus).not.toHaveBeenCalled();
    expect(api.repairComfyUiInstall).not.toHaveBeenCalled();
    expect(api.readPythonRuntimeStatus).not.toHaveBeenCalled();
  });

  it("renders Artifacts shell and upload form without remote artifact operations or selected detail reads", async () => {
    const { container: c, api } = await mount(<ArtifactsPage workspaceId="w1" workspaceName="Workspace" refreshToken={0} onUploaded={() => undefined} />);
    expect(c.textContent).toContain("Data Management");
    expect(c.textContent).toContain("Artifact Ingestion");
    expect(api.publishArtifactToRepo).not.toHaveBeenCalled();
    expect(api.localizeArtifactFromRepo).not.toHaveBeenCalled();
    expect(api.browseHuggingFaceNamespaceDatasets).not.toHaveBeenCalled();
    expect(api.readArtifactDetail).not.toHaveBeenCalled();
  });

  it("loads artifact detail only after the browser section selects an artifact", async () => {
    const api = createDesktopApiMock();
    api.browseArtifacts = vi.fn().mockResolvedValue(envelope({ items: [{ storageKey: "uploads/a.txt", originalName: "a.txt", artifactFamily: "document", mediaType: "text/plain" }] }));
    const { container: c } = await mount(<ArtifactsPage workspaceId="w1" workspaceName="Workspace" refreshToken={0} onUploaded={() => undefined} />, api);
    const browserTab = Array.from(c.querySelectorAll("button")).find((button) => button.textContent === "Artifact Browser");
    await act(async () => { browserTab?.click(); await Promise.resolve(); });
    expect(api.readArtifactDetail).not.toHaveBeenCalled();
    expect(c.textContent).toContain("a.txt");
    const artifactButton = Array.from(c.querySelectorAll("button")).find((button) => button.textContent?.includes("View Details"));
    await act(async () => { artifactButton?.click(); await Promise.resolve(); });
    expect(api.readArtifactDetail).toHaveBeenCalled();
  });

  it("keeps Asset Library resource-backed views separate from initial definitions", async () => {
    const { container: c, api } = await mount(<AssetLibraryPage workspaceId="w1" workspaceName="Workspace" />);
    expect(c.textContent).toContain("Asset Library");
    expect(api.listAssetDefinitions).toHaveBeenCalled();
    expect(api.listAssetResourceBackedViews).not.toHaveBeenCalled();
    const tab = Array.from(c.querySelectorAll("button")).find((button) => button.textContent === "Resource views");
    await act(async () => { tab?.click(); await Promise.resolve(); });
    expect(api.listAssetResourceBackedViews).toHaveBeenCalled();
  });

  it("defers runtime-specific Settings sections until expanded", async () => {
    const { container: c, api } = await mount(<SettingsPage />);
    expect(c.textContent).toContain("Settings");
    expect(api.listApplicationSettingDefinitions).toHaveBeenCalledTimes(2);
    const runtimeButton = Array.from(c.querySelectorAll("button")).find((button) => button.textContent?.includes("Runtime settings"));
    await act(async () => { runtimeButton?.click(); await Promise.resolve(); });
    expect(api.listApplicationSettingDefinitions).toHaveBeenCalledTimes(3);
    expect(api.readComfyUiInstallStatus).not.toHaveBeenCalled();
  });

  it("defers System runtime controls until expanded", async () => {
    const { container: c, api } = await mount(<SystemPage />);
    expect(c.textContent).toContain("System");
    expect(api.readPythonRuntimeStatus).not.toHaveBeenCalled();
    expect(api.controlPythonRuntime).not.toHaveBeenCalled();
    expect(api.readComfyUiInstallStatus).not.toHaveBeenCalled();
    const comfyButton = Array.from(c.querySelectorAll("button")).find((button) => button.textContent?.includes("ComfyUI"));
    await act(async () => { comfyButton?.click(); await Promise.resolve(); });
    expect(api.readComfyUiInstallStatus).toHaveBeenCalledTimes(1);
    expect(api.controlPythonRuntime).not.toHaveBeenCalled();
  });
});
