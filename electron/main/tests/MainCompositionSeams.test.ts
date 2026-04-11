import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");

describe("electron main composition seam extraction", () => {
  it("delegates window management details to DesktopWindowManager", () => {
    expect(mainSource).toContain("createDesktopWindowManager({");
    expect(mainSource).toContain("windowManager.launchRuntimeWindowFromContract");
    expect(mainSource).not.toContain("function createRendererSearch(");
    expect(mainSource).not.toContain("function loadRendererRoot(");
    expect(mainSource).not.toContain("function launchRuntimeWindowFromContract(");
  });

  it("delegates app event wiring to DesktopAppLifecycle", () => {
    expect(mainSource).toContain("registerDesktopAppLifecycle({");
    expect(mainSource).not.toContain("app.whenReady().then(async () => {");
    expect(mainSource).not.toContain("app.on(\"window-all-closed\"");
    expect(mainSource).not.toContain("app.on(\"before-quit\"");
  });
});
