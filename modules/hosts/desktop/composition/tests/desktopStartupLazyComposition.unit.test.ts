import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import type { IpcMainHandlePort } from "../../../../adapters/transport/ipc-electron/ipcMainHandlePort";
import { composeDesktopHost } from "../composeDesktopHost";
import {
  DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL,
  DESKTOP_COMFYUI_INSTALL_STATUS_READ_REQUEST_CHANNEL,
  DESKTOP_IMAGE_GENERATION_START_REQUEST_CHANNEL,
  DESKTOP_MODEL_LIST_REQUEST_CHANNEL,
  DESKTOP_WORKSPACE_CREATE_REQUEST_CHANNEL,
  DESKTOP_WORKSPACE_LIST_REQUEST_CHANNEL,
  DESKTOP_WORKSPACE_SELECTION_READ_REQUEST_CHANNEL,
  createDesktopArtifactBrowseRequest,
  createDesktopComfyUiInstallStatusRequest,
  createDesktopImageGenerationStartRequest,
  createDesktopModelListRequest,
  createDesktopWorkspaceCreateRequest,
  createDesktopWorkspaceListRequest,
  createDesktopWorkspaceSelectionReadRequest,
} from "../../../../contracts/ipc";

type Handler = (event: unknown, request: unknown) => Promise<unknown> | unknown;

function createIpcHarness() {
  const handlers = new Map<string, Handler>();
  const ipcMain = {
    handle: testDouble.fn((channel: string, handler: Handler) => {
      handlers.set(channel, handler);
    }),
  };
  return {
    ipcMain: ipcMain as unknown as IpcMainHandlePort & typeof ipcMain,
    handlers,
    invoke(channel: string, request: unknown) {
      const handler = handlers.get(channel);
      if (!handler) {
        throw new Error(`No handler registered for ${channel}.`);
      }
      return handler({}, request);
    },
  };
}

async function composeRegisteredHost() {
  const storageRootDirectory = await mkdtemp(join(tmpdir(), "desktop-lazy-startup-storage-"));
  const runtimeRootDirectory = await mkdtemp(join(tmpdir(), "desktop-lazy-startup-runtime-"));
  const harness = createIpcHarness();
  const host = composeDesktopHost({
    artifactRepo: {
      huggingFaceTokenConfigFilePath: join(storageRootDirectory, "config", "hf-token.json"),
      huggingFaceFetchImplementation: testDouble.fn(async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
    },
    settings: {
      localSettingsFilePath: join(storageRootDirectory, "config", "settings.json"),
    },
  });
  host.registerDesktopIpc({
    ipcMain: harness.ipcMain,
    storageRootDirectory,
    runtimeRootDirectory,
  });
  return { host, storageRootDirectory, runtimeRootDirectory, ...harness };
}

async function captureMemoryMilestones<T>(run: () => T | Promise<T>): Promise<{ result: T; milestones: string[] }> {
  const previous = process.env.DESKTOP_MEMORY_DIAGNOSTICS;
  process.env.DESKTOP_MEMORY_DIAGNOSTICS = "1";
  const lines: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => {
    if (typeof line === "string") {
      lines.push(line);
    }
  };
  try {
    const result = await run();
    return { result, milestones: lines.map((line) => JSON.parse(line).milestone as string) };
  } finally {
    console.log = original;
    if (previous === undefined) {
      delete process.env.DESKTOP_MEMORY_DIAGNOSTICS;
    } else {
      process.env.DESKTOP_MEMORY_DIAGNOSTICS = previous;
    }
  }
}

const deferredMilestones = [
  "desktop.host.artifact-features.compose.before",
  "desktop.host.asset-features.compose.before",
  "desktop.host.model-features.compose.before",
  "desktop.host.image-generation-features.compose.before",
  "desktop.host.ingestion-features.compose.before",
  "desktop.host.dataset-preparation-features.compose.before",
  "desktop.host.huggingface-features.compose.before",
  "desktop.host.comfyui-features.compose.before",
  "desktop.host.runtime-task-features.compose.before",
];

describe("desktop startup lazy composition contract", () => {
  it("registers the IPC surface without composing deferred feature groups", async () => {
    const storageRootDirectory = await mkdtemp(join(tmpdir(), "desktop-lazy-registration-storage-"));
    const runtimeRootDirectory = await mkdtemp(join(tmpdir(), "desktop-lazy-registration-runtime-"));
    const harness = createIpcHarness();

    const { result, milestones } = await captureMemoryMilestones(() => {
      const host = composeDesktopHost({
        artifactRepo: { huggingFaceTokenConfigFilePath: join(storageRootDirectory, "config", "hf-token.json") },
        settings: { localSettingsFilePath: join(storageRootDirectory, "config", "settings.json") },
      });
      host.registerDesktopIpc({ ipcMain: harness.ipcMain, storageRootDirectory, runtimeRootDirectory });
      return host;
    });

    expect(result.getInternalAssetRegistry()).toBeUndefined();
    expect(harness.ipcMain.handle.mock.calls.length).toBe(65);
    expect(milestones).toContain("desktop.host.startup-workspace-shell.compose.before");
    expect(milestones).toContain("desktop.host.startup-workspace-shell.compose.after");
    expect(milestones).toContain("desktop.host.ipc-registration.lazy-handlers.before");
    expect(milestones).toContain("desktop.host.ipc-registration.lazy-handlers.after");
    for (const milestone of deferredMilestones) {
      expect(milestones).not.toContain(milestone);
    }
  });

  it("supports workspace list/create/selection through the startup workspace shell", async () => {
    const harness = await composeRegisteredHost();

    const emptyList = await harness.invoke(DESKTOP_WORKSPACE_LIST_REQUEST_CHANNEL.value, createDesktopWorkspaceListRequest({}));
    expect((emptyList as { ok: boolean; value: { workspaces: unknown[] } }).ok).toBe(true);
    expect((emptyList as { value: { workspaces: unknown[] } }).value.workspaces).toEqual([]);

    const created = await harness.invoke(DESKTOP_WORKSPACE_CREATE_REQUEST_CHANNEL.value, createDesktopWorkspaceCreateRequest({
      command: { displayName: "Lazy Startup Workspace", includeSystemFoundationAssets: false },
      selectAfterCreate: true,
    }));
    expect((created as { ok: boolean }).ok).toBe(true);

    const selection = await harness.invoke(DESKTOP_WORKSPACE_SELECTION_READ_REQUEST_CHANNEL.value, createDesktopWorkspaceSelectionReadRequest());
    expect((selection as { ok: boolean; value: { workspaceId?: string } }).ok).toBe(true);
    expect(Boolean((selection as { value: { workspaceId?: string } }).value.workspaceId)).toBe(true);
  });

  it("composes model features on the first model request and memoizes them", async () => {
    const harness = await composeRegisteredHost();
    const { milestones: firstMilestones } = await captureMemoryMilestones(() => harness.invoke(DESKTOP_MODEL_LIST_REQUEST_CHANNEL.value, createDesktopModelListRequest({})));
    const { milestones: secondMilestones } = await captureMemoryMilestones(() => harness.invoke(DESKTOP_MODEL_LIST_REQUEST_CHANNEL.value, createDesktopModelListRequest({})));

    expect(firstMilestones).toContain("desktop.host.model-features.compose.before");
    expect(firstMilestones).toContain("desktop.host.model-features.compose.after");
    expect(firstMilestones).not.toContain("desktop.host.comfyui-features.compose.before");
    expect(firstMilestones).not.toContain("desktop.host.runtime-task-features.compose.before");
    expect(secondMilestones).not.toContain("desktop.host.model-features.compose.before");
  });

  it("composes image-generation, artifact, and ComfyUI feature groups only on first relevant requests", async () => {
    const harness = await composeRegisteredHost();

    const { milestones: artifactMilestones } = await captureMemoryMilestones(() => harness.invoke(DESKTOP_ARTIFACT_BROWSE_REQUEST_CHANNEL.value, createDesktopArtifactBrowseRequest({
        workspaceId: "workspace.lazy-startup",
        boundary: { host: "desktop", source: "test" },
      })));
    expect(artifactMilestones).toContain("desktop.host.artifact-features.compose.before");
    expect(artifactMilestones).not.toContain("desktop.host.huggingface-features.compose.before");

    const { milestones: imageMilestones } = await captureMemoryMilestones(() => harness.invoke(DESKTOP_IMAGE_GENERATION_START_REQUEST_CHANNEL.value, createDesktopImageGenerationStartRequest({ prompt: "cat" })));
    expect(imageMilestones).toContain("desktop.host.image-generation-features.compose.before");
    expect(imageMilestones).toContain("desktop.host.comfyui-features.compose.before");
    expect(imageMilestones).toContain("desktop.host.runtime-task-features.compose.before");

    const { milestones: comfyUiMilestones } = await captureMemoryMilestones(() => harness.invoke(DESKTOP_COMFYUI_INSTALL_STATUS_READ_REQUEST_CHANNEL.value, createDesktopComfyUiInstallStatusRequest({})));
    expect(comfyUiMilestones).not.toContain("desktop.host.comfyui-features.compose.before");
  });
});
