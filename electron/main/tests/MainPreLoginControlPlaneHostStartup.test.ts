import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const authShellStart = mainSource.indexOf("async function bootstrapAuthShell()");
const authShellEnd = mainSource.indexOf("const postLoginRuntimeDependencyActivator = createPostLoginRuntimeDependencyActivator({");
const authShellSource = authShellStart >= 0 && authShellEnd > authShellStart
  ? mainSource.slice(authShellStart, authShellEnd)
  : "";
const ensureBoundStart = mainSource.indexOf("async function ensureDesktopControlPlaneHostBound(");
const ensureBoundEnd = mainSource.indexOf("async function bootstrapAuthShell(): Promise<AuthShellBootstrapResult> {");
const ensureBoundSource = ensureBoundStart >= 0 && ensureBoundEnd > ensureBoundStart
  ? mainSource.slice(ensureBoundStart, ensureBoundEnd)
  : "";

describe("electron main pre-login control-plane host startup", () => {
  it("starts authoritative server host assembly for pre-login bootstrap", () => {
    expect(mainSource).toContain("startAuthoritativeServerHostAssembly");
    expect(mainSource).toContain("composeDesktopAuthoritativeServerApiRouteRegistrationPlan");
    expect(mainSource).toContain("composeApiRouteRegistrationPlan: composeDesktopAuthoritativeServerApiRouteRegistrationPlan");
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

  it("keeps bind-once host reuse flow explicit for desktop-session continuity", () => {
    expect(ensureBoundSource).toContain("const existingRuntime = controlPlaneServerRuntime");
    expect(ensureBoundSource).toContain("Reusing authoritative control-plane host at");
    expect(ensureBoundSource).toContain("reason: \"authoritative-host-bind-reused\"");
    expect(ensureBoundSource).toContain("reason: \"authoritative-host-bind-start\"");
    expect(ensureBoundSource).toContain("reason: \"authoritative-host-bind-ready\"");
    expect(ensureBoundSource).not.toContain("existingRuntime.stop(");
  });
});
