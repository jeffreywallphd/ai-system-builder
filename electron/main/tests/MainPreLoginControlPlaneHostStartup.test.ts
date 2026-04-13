import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const authShellStart = mainSource.indexOf("async function bootstrapAuthShell()");
const authShellEnd = mainSource.indexOf("const postLoginRuntimeBootstrapper = createPostLoginRuntimeBootstrapper({");
const authShellSource = authShellStart >= 0 && authShellEnd > authShellStart
  ? mainSource.slice(authShellStart, authShellEnd)
  : "";

describe("electron main pre-login control-plane host startup", () => {
  it("starts authoritative server host assembly for pre-login bootstrap", () => {
    expect(mainSource).toContain("startAuthoritativeServerHostAssembly");
    expect(mainSource).toContain("electron-main-authoritative-server-host-startup");
    expect(mainSource).toContain("Starting authoritative control-plane host with bind-once desktop lifecycle");
    expect(mainSource).toContain("Authoritative control-plane host ready at");
    expect(mainSource).toContain("bind-once");
  });

  it("keeps legacy auth-minimal host startup removed from pre-login bootstrap", () => {
    expect(authShellSource).not.toContain("startAuthMinimalServerHostAssembly");
    expect(mainSource).not.toContain("auth-minimal");
  });

  it("does not resolve python runtime or start service supervisor in pre-login bootstrap", () => {
    expect(authShellSource).not.toContain("resolveDesktopPythonRuntime(");
    expect(authShellSource).not.toContain("new DesktopServiceSupervisor(");
    expect(authShellSource).not.toContain("serviceSupervisor.start(");
    expect(authShellSource).not.toContain("startMonitoring(");
  });
});
