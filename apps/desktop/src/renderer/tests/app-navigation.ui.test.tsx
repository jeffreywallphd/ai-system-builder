import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).Event = dom.window.Event;
(globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
(globalThis as any).HTMLSelectElement = dom.window.HTMLSelectElement;
(globalThis as any).InputEvent = dom.window.InputEvent;
(globalThis as any).FormData = dom.window.FormData;
(globalThis as any).Request = dom.window.Request;
(globalThis as any).Response = dom.window.Response;
(globalThis as any).localStorage = dom.window.localStorage;
(globalThis as any).sessionStorage = dom.window.sessionStorage;
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function waitForText(container: HTMLElement, text: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (container.textContent?.includes(text)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
  }
}

describe("desktop renderer page composition", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => {
        mountedRoot?.unmount();
      });
    }
    mountedContainer?.remove();
    delete window.desktopApi;
    window.localStorage.clear();
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  it("renders landing Home page by default and switches to Data/Settings/System pages", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    const workspaces = [{ workspaceId: "research-workspace", displayName: "Research Workspace", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }];
    let selectedWorkspaceId: string | undefined;
    window.desktopApi = {
      listWorkspaces: vi.fn(async () => ({ ok: true, value: { workspaces } })),
      readActiveWorkspaceSelection: vi.fn(async () => ({ ok: true, value: selectedWorkspaceId ? { workspaceId: selectedWorkspaceId } : {} })),
      saveActiveWorkspaceSelection: vi.fn(async (selection: { workspaceId?: string }) => { selectedWorkspaceId = selection.workspaceId; return { ok: true, value: { selection } }; }),
      clearActiveWorkspaceSelection: vi.fn(async () => { selectedWorkspaceId = undefined; return { ok: true, value: {} }; }),
      createWorkspace: vi.fn(async (input: { command: { displayName: string; includeSystemFoundationAssets?: boolean } }) => { const workspace = { workspaceId: "workspace.created", displayName: input.command.displayName, status: "active", createdAt: "2026-05-14T00:00:00.000Z", settings: { defaultIncludeSystemFoundationAssets: input.command.includeSystemFoundationAssets } }; workspaces.push(workspace); selectedWorkspaceId = workspace.workspaceId; return { ok: true, value: { workspace } }; }),
      uploadArtifact: vi.fn().mockRejectedValue(new Error("unused")),
      browseArtifacts: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      readArtifactDetail: vi.fn().mockRejectedValue(new Error("unused")),
      readArtifactContentDescriptor: vi.fn().mockRejectedValue(new Error("unused")),
      readArtifactViewerMedia: vi.fn().mockRejectedValue(new Error("unused")),
      publishArtifactToRepo: vi.fn().mockRejectedValue(new Error("unused")),
      verifyPublishedArtifactBacking: vi.fn().mockRejectedValue(new Error("unused")),
      registerArtifactFromRepo: vi.fn().mockRejectedValue(new Error("unused")),
      localizeArtifactFromRepo: vi.fn().mockRejectedValue(new Error("unused")),
      listAssetDefinitions: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      readAssetDefinition: vi.fn().mockRejectedValue(new Error("unused")),
      readAssetDefinitionVersion: vi.fn().mockRejectedValue(new Error("unused")),
      listAssetResourceBackedViews: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      readAssetResourceBackedView: vi.fn().mockRejectedValue(new Error("unused")),
      registerResourceBackedViewAsAsset: vi.fn().mockRejectedValue(new Error("unused")),
      finalizeGeneratedOutputAsAsset: vi.fn().mockRejectedValue(new Error("unused")),
      importExternalRepositoryObjectAsAsset: vi.fn().mockRejectedValue(new Error("unused")),
      localizeExternalRepositoryObjectAsAsset: vi.fn().mockRejectedValue(new Error("unused")),
      readPythonRuntimeStatus: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          supervisorStatus: "stopped",
          healthy: false,
          runtimeStatus: "stopped",
          capabilities: [],
          logs: [],
        },
      }),
      controlPythonRuntime: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          supervisorStatus: "starting",
          healthy: false,
          runtimeStatus: "starting",
          capabilities: [],
          logs: [],
        },
      }),
      browseModels: vi.fn().mockResolvedValue({ ok: true, value: { models: [] } }),
      getModelDetails: vi.fn().mockResolvedValue({ ok: true, value: { model: { provider: "huggingface", modelId: "org/demo", displayName: "Demo" } } }),
      listModels: vi.fn().mockResolvedValue({ ok: true, value: { models: [] } }),
      saveModelReference: vi.fn().mockResolvedValue({ ok: true, value: { model: { modelRecordId: "m1", displayName: "Demo", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", provider: "huggingface", createdAt: "2026-04-27T00:00:00.000Z" } } }),
      updateModelRecord: vi.fn().mockResolvedValue({ ok: true, value: { model: { modelRecordId: "m1", displayName: "Demo", source: "huggingface", lifecycleStatus: "saved-reference", artifactForm: "full-model", provider: "huggingface", createdAt: "2026-04-27T00:00:00.000Z" } } }),
      deleteModelRecord: vi.fn().mockResolvedValue({ ok: true, value: { deletedModelRecordId: "m1", deletedRegistryRecord: true, deletedLocalFiles: false, deletedBackingArtifactIds: [] } }),
    };

    await act(async () => {
      root.render(<App />);
    });

    await waitForText(container, "Build visual AI workflows from your artifacts");
    expect(container.textContent).toContain("Build visual AI workflows from your artifacts");

    const artifactsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Data",
    );
    expect(artifactsButton).toBeDefined();

    await act(async () => {
      artifactsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Create a workspace to use Assets, Artifacts, Data, Models, and Images.");
    expect(container.textContent).toContain("Create workspace");
    expect(container.textContent).not.toContain("Data Artifact Ingester");
    expect(window.desktopApi?.browseArtifacts).not.toHaveBeenCalled();

    selectedWorkspaceId = "research-workspace";
    await act(async () => {
      root.unmount();
    });
    const remountedRoot = createRoot(container);
    mountedRoot = remountedRoot;
    await act(async () => {
      remountedRoot.render(<App />);
    });
    const assetsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Assets",
    );
    expect(assetsButton).toBeDefined();

    await act(async () => {
      assetsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Loading page…");
    expect(container.querySelector("button[aria-current='page']")?.textContent).toBe("Assets");
    expect(window.desktopApi?.listAssetDefinitions).not.toHaveBeenCalled();

    const settingsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Settings",
    );
    expect(settingsButton).toBeDefined();

    await act(async () => {
      settingsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Loading page…");
    expect(container.querySelector("button[aria-current='page']")?.getAttribute("aria-label")).toBe("Settings");

    const systemButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "System",
    );
    expect(systemButton).toBeDefined();

    await act(async () => {
      systemButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Loading page…");
    expect(container.querySelector("button[aria-current='page']")?.textContent).toBe("System");
  });
});
