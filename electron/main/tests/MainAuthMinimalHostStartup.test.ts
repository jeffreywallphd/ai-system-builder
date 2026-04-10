import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const authShellStart = mainSource.indexOf("async function bootstrapAuthShell()");
const authShellEnd = mainSource.indexOf("function registerDeferredFeatureIpc(");
const authShellSource = authShellStart >= 0 && authShellEnd > authShellStart
  ? mainSource.slice(authShellStart, authShellEnd)
  : "";

describe("electron main pre-login host startup", () => {
  it("starts auth-minimal server host assembly for pre-login bootstrap", () => {
    expect(mainSource).toContain("startAuthMinimalServerHostAssembly");
    expect(mainSource).toContain("electron-main-auth-minimal-server-host-startup");
    expect(mainSource).toContain("Starting auth-minimal identity host for pre-login bootstrap");
  });

  it("does not call full authoritative server host startup in pre-login bootstrap", () => {
    expect(mainSource).not.toContain("startAuthoritativeServerHostAssembly");
  });

  it("does not resolve python runtime or start service supervisor in pre-login bootstrap", () => {
    expect(authShellSource).not.toContain("resolveDesktopPythonRuntime(");
    expect(authShellSource).not.toContain("new DesktopServiceSupervisor(");
    expect(authShellSource).not.toContain("serviceSupervisor.start(");
    expect(authShellSource).not.toContain("startMonitoring(");
  });
});
