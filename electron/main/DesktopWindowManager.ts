import path from "node:path";
import { RendererDeliveryModes } from "../../src/domain/runtime/AppRuntimeProfile";
import {
  parseSystemRuntimeWindowLaunchContract,
  SystemRuntimeWindowLaunchQueryParam,
  type LaunchSystemRuntimeWindowReadModel,
} from "../../src/application/system-runtime/SystemRuntimeWindowLaunchContract";

export type BrowserWindowShape = {
  loadFile(filePath: string, options?: { readonly search?: string }): Promise<void>;
  loadURL(url: string): Promise<void>;
  once(event: "ready-to-show", listener: () => void): void;
  on(event: "closed", listener: () => void): void;
  focus(): void;
  show(): void;
  maximize(): void;
  isDestroyed(): boolean;
  readonly webContents: {
    openDevTools(options?: { readonly mode: "detach" }): void;
  };
};

export type BrowserWindowConstructorShape<TWindow extends BrowserWindowShape> = {
  new(options: Record<string, unknown>): TWindow;
  getAllWindows(): TWindow[];
};

export type DesktopWindowManagerRuntimeConfig = {
  readonly rendererDeliveryMode?: string;
};

export type DesktopWindowManagerOptions<TWindow extends BrowserWindowShape> = {
  readonly BrowserWindow: BrowserWindowConstructorShape<TWindow>;
  readonly preloadScriptPath: string;
  readonly rendererDevUrl: string;
  readonly isPackaged: boolean;
  readonly mainProcessDir: string;
  readonly getRuntimeConfig: () => DesktopWindowManagerRuntimeConfig | undefined;
};

export type DesktopWindowManager<TWindow extends BrowserWindowShape> = {
  createMainWindow(hooks?: {
    readonly onReadyToShow?: () => void;
    readonly onRendererLoaded?: () => void;
    readonly onComplete?: () => void;
  }): Promise<void>;
  loadRendererRoot(window: TWindow, search?: string): Promise<void>;
  launchRuntimeWindowFromContract(launchContractJson: string): Promise<LaunchSystemRuntimeWindowReadModel>;
  getMainWindow(): TWindow | undefined;
  hasOpenWindows(): boolean;
};

export function createRendererSearch(params: Record<string, string | undefined>): string | undefined {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (!value) {
      continue;
    }
    search.set(key, value);
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : undefined;
}

export function createDesktopWindowManager<TWindow extends BrowserWindowShape>(
  options: DesktopWindowManagerOptions<TWindow>,
): DesktopWindowManager<TWindow> {
  let mainWindow: TWindow | undefined;
  const runtimeWindowByReuseKey = new Map<string, TWindow>();

  async function loadRendererRoot(window: TWindow, search?: string): Promise<void> {
    const runtimeConfig = options.getRuntimeConfig();
    if (runtimeConfig?.rendererDeliveryMode === RendererDeliveryModes.packagedAssets) {
      await window.loadFile(path.join(options.mainProcessDir, "../../dist/index.html"), {
        search,
      });
      return;
    }
    const url = new URL(options.rendererDevUrl);
    url.pathname = "/";
    if (search) {
      url.search = search.startsWith("?") ? search.slice(1) : search;
    }
    await window.loadURL(url.toString());
    if (window === mainWindow && !options.isPackaged) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  }

  async function createMainWindow(hooks?: {
    readonly onReadyToShow?: () => void;
    readonly onRendererLoaded?: () => void;
    readonly onComplete?: () => void;
  }): Promise<void> {
    const window = new options.BrowserWindow({
      width: 1440,
      height: 960,
      show: false,
      backgroundColor: "#111827",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: options.preloadScriptPath,
      },
    });

    mainWindow = window;
    window.once("ready-to-show", () => {
      hooks?.onReadyToShow?.();
      window.maximize();
      window.show();
    });

    try {
      await loadRendererRoot(window);
      hooks?.onRendererLoaded?.();
    } finally {
      hooks?.onComplete?.();
    }
  }

  async function launchRuntimeWindowFromContract(
    launchContractJson: string,
  ): Promise<LaunchSystemRuntimeWindowReadModel> {
    const contract = parseSystemRuntimeWindowLaunchContract(launchContractJson);
    if (!contract) {
      throw new Error("invalid-request:Runtime window launch contract is missing or invalid.");
    }

    const reuseWindowKey = contract.windowIntent.reuseWindowKey?.trim();
    if (reuseWindowKey) {
      const existing = runtimeWindowByReuseKey.get(reuseWindowKey);
      if (existing && !existing.isDestroyed()) {
        const search = createRendererSearch({
          [SystemRuntimeWindowLaunchQueryParam]: launchContractJson,
        });
        await loadRendererRoot(existing, search);
        if (contract.windowIntent.focus === "foreground") {
          existing.focus();
        }
        return Object.freeze({
          launchId: contract.launchId,
          launchedAt: new Date().toISOString(),
          targetKind: contract.launchTarget.targetKind,
          systemAssetId: contract.launchTarget.systemAssetId,
          pageBindingId: contract.launchTarget.pageBindingId,
          routePath: "/",
        });
      }
    }

    const runtimeWindow = new options.BrowserWindow({
      width: contract.windowIntent.dimensions?.width ?? 1440,
      height: contract.windowIntent.dimensions?.height ?? 960,
      show: false,
      backgroundColor: "#111827",
      title: contract.windowIntent.titleHint ?? "AI Loom Runtime",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: options.preloadScriptPath,
      },
    });

    runtimeWindow.once("ready-to-show", () => runtimeWindow.show());
    const search = createRendererSearch({
      [SystemRuntimeWindowLaunchQueryParam]: launchContractJson,
    });
    await loadRendererRoot(runtimeWindow, search);

    if (contract.windowIntent.focus === "foreground") {
      runtimeWindow.focus();
    }

    if (reuseWindowKey) {
      runtimeWindowByReuseKey.set(reuseWindowKey, runtimeWindow);
      runtimeWindow.on("closed", () => {
        runtimeWindowByReuseKey.delete(reuseWindowKey);
      });
    }

    return Object.freeze({
      launchId: contract.launchId,
      launchedAt: new Date().toISOString(),
      targetKind: contract.launchTarget.targetKind,
      systemAssetId: contract.launchTarget.systemAssetId,
      pageBindingId: contract.launchTarget.pageBindingId,
      routePath: "/",
    });
  }

  return {
    createMainWindow,
    loadRendererRoot,
    launchRuntimeWindowFromContract,
    getMainWindow: () => mainWindow,
    hasOpenWindows: () => options.BrowserWindow.getAllWindows().length > 0,
  };
}
