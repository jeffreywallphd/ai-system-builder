import { describe, expect, it } from "bun:test";
import {
  createSystemRuntimeWindowLaunchContract,
  serializeSystemRuntimeWindowLaunchContract,
} from "../../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";
import { createDesktopWindowManager, createRendererSearch, type BrowserWindowShape } from "../DesktopWindowManager";

class FakeWindow implements BrowserWindowShape {
  static allWindows: FakeWindow[] = [];

  public readonly webContents = {
    openDevTools: () => {
      this.devToolsOpenCount += 1;
    },
  };

  public loadFileCalls: Array<{ filePath: string; search?: string }> = [];
  public loadUrlCalls: string[] = [];
  public focusCount = 0;
  public showCount = 0;
  public maximizeCount = 0;
  public devToolsOpenCount = 0;
  public destroyed = false;
  private readonly listeners = new Map<string, Array<() => void>>();

  constructor(public readonly options: Record<string, unknown>) {
    FakeWindow.allWindows.push(this);
  }

  static getAllWindows(): FakeWindow[] {
    return FakeWindow.allWindows.filter((entry) => !entry.destroyed);
  }

  async loadFile(filePath: string, options?: { readonly search?: string }): Promise<void> {
    this.loadFileCalls.push({ filePath, search: options?.search });
  }

  async loadURL(url: string): Promise<void> {
    this.loadUrlCalls.push(url);
  }

  once(event: "ready-to-show", listener: () => void): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener]);
  }

  on(event: "closed", listener: () => void): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener]);
  }

  emit(event: "ready-to-show" | "closed"): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener();
    }
  }

  focus(): void {
    this.focusCount += 1;
  }

  show(): void {
    this.showCount += 1;
  }

  maximize(): void {
    this.maximizeCount += 1;
  }

  isDestroyed(): boolean {
    return this.destroyed;
  }
}

function createLaunchContractJson(reuseWindowKey: string): string {
  return serializeSystemRuntimeWindowLaunchContract(
    createSystemRuntimeWindowLaunchContract({
      contractVersion: "ai-loom.runtime-window-launch.v1",
      launchId: "runtime-window:launch-1",
      createdAt: "2026-04-03T10:00:00.000Z",
      launchTarget: {
        targetKind: "standalone-system",
        systemAssetId: "asset:system:image",
        pageBindingId: "system-page:image-manipulation",
      },
      resolution: {
        studioId: "system-studio",
        draftId: "draft-1",
        systemAssetId: "asset:system:image",
      },
      runtimeContextPayload: {},
      datasetBindings: [],
      initialSelection: {},
      launchMode: "interactive",
      windowIntent: {
        intent: "runtime-editor",
        focus: "foreground",
        reuseWindowKey,
      },
      expectedResult: {
        expectedResult: "execution-summary",
        metadata: {},
      },
    }),
  );
}

describe("DesktopWindowManager", () => {
  it("omits undefined search params and prefixes serialized query with ?", () => {
    expect(createRendererSearch({ a: "1", b: undefined })).toBe("?a=1");
    expect(createRendererSearch({ missing: undefined })).toBeUndefined();
  });

  it("reuses runtime window instances by reuseWindowKey", async () => {
    FakeWindow.allWindows = [];
    const manager = createDesktopWindowManager({
      BrowserWindow: FakeWindow,
      preloadScriptPath: "/tmp/preload.cjs",
      rendererDevUrl: "http://127.0.0.1:5174",
      isPackaged: false,
      mainProcessDir: "/workspace/ai-loom-studio/electron/main",
      getRuntimeConfig: () => ({ rendererDeliveryMode: "dev-server" }),
    });

    const launchJson = createLaunchContractJson("runtime:window:reuse");
    await manager.launchRuntimeWindowFromContract(launchJson);
    expect(FakeWindow.allWindows).toHaveLength(1);

    const existing = FakeWindow.allWindows[0];
    await manager.launchRuntimeWindowFromContract(launchJson);
    expect(FakeWindow.allWindows).toHaveLength(1);
    expect(existing.focusCount).toBe(2);
    expect(existing.loadUrlCalls.length).toBe(2);

    existing.destroyed = true;
    existing.emit("closed");
    await manager.launchRuntimeWindowFromContract(launchJson);
    expect(FakeWindow.allWindows).toHaveLength(2);
  });
});
