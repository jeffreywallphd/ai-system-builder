import { describe, expect, it } from "bun:test";
import { registerDesktopAppLifecycle, type DesktopAppLifecycleApp } from "../DesktopAppLifecycle";

class FakeApp implements DesktopAppLifecycleApp {
  private readonly listeners = new Map<string, Array<() => void | Promise<void>>>();
  public quitCount = 0;
  public exitCodes: number[] = [];

  whenReady(): Promise<void> {
    return Promise.resolve();
  }

  on(event: "activate" | "window-all-closed" | "before-quit", listener: () => void | Promise<void>): void {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener]);
  }

  quit(): void {
    this.quitCount += 1;
  }

  exit(code?: number): void {
    this.exitCodes.push(code ?? 0);
  }

  async emit(event: "activate" | "window-all-closed" | "before-quit"): Promise<void> {
    for (const listener of this.listeners.get(event) ?? []) {
      await listener();
    }
  }
}

describe("registerDesktopAppLifecycle", () => {
  it("recreates main window on activate when no windows are open", async () => {
    const app = new FakeApp();
    let createMainWindowCalls = 0;

    registerDesktopAppLifecycle({
      app,
      hasOpenWindows: () => false,
      createMainWindow: async () => {
        createMainWindowCalls += 1;
      },
      bootstrapDesktopHost: async () => undefined,
      stopDesktopHost: async () => undefined,
      isMacOS: true,
    });

    await Promise.resolve();
    await Promise.resolve();
    await app.emit("activate");

    expect(createMainWindowCalls).toBe(1);
  });

  it("quits on window-all-closed outside macOS and awaits stop hook on before-quit", async () => {
    const app = new FakeApp();
    let stopCalls = 0;

    registerDesktopAppLifecycle({
      app,
      hasOpenWindows: () => true,
      createMainWindow: async () => undefined,
      bootstrapDesktopHost: async () => undefined,
      stopDesktopHost: async () => {
        stopCalls += 1;
      },
      isMacOS: false,
    });

    await app.emit("window-all-closed");
    await app.emit("before-quit");

    expect(app.quitCount).toBe(1);
    expect(stopCalls).toBe(1);
  });
});
