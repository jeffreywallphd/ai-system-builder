export type DesktopAppLifecycleApp = {
  whenReady(): Promise<void>;
  on(event: "activate", listener: () => void | Promise<void>): void;
  on(event: "window-all-closed", listener: () => void): void;
  on(event: "before-quit", listener: () => void | Promise<void>): void;
  quit(): void;
  exit(code?: number): void;
};

export type DesktopAppLifecycleOptions = {
  readonly app: DesktopAppLifecycleApp;
  readonly hasOpenWindows: () => boolean;
  readonly createMainWindow: () => Promise<void>;
  readonly bootstrapDesktopHost: () => Promise<void>;
  readonly stopDesktopHost: () => Promise<void>;
  readonly isMacOS: boolean;
  readonly logBootstrapFailure?: (error: unknown) => void;
};

export function registerDesktopAppLifecycle(options: DesktopAppLifecycleOptions): void {
  options.app.whenReady().then(async () => {
    await options.bootstrapDesktopHost();
    options.app.on("activate", async () => {
      if (!options.hasOpenWindows()) {
        await options.createMainWindow();
      }
    });
  }).catch((error) => {
    if (options.logBootstrapFailure) {
      options.logBootstrapFailure(error);
    } else {
      console.error("Failed to bootstrap desktop host", error);
    }
    options.app.exit(1);
  });

  options.app.on("window-all-closed", () => {
    if (!options.isMacOS) {
      options.app.quit();
    }
  });

  options.app.on("before-quit", async () => {
    await options.stopDesktopHost();
  });
}
