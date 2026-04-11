import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const bootstrapperSource = fs.readFileSync(
  path.resolve(process.cwd(), "electron/main/runtime/PostLoginRuntimeBootstrapper.ts"),
  "utf8",
);

describe("electron main post-login runtime composition", () => {
  it("delegates post-login runtime composition to a dedicated bootstrapper module", () => {
    expect(mainSource).toContain("createPostLoginRuntimeBootstrapper({");
    expect(mainSource).toContain("postLoginRuntimeBootstrapper.bootstrap(authShell)");
    expect(mainSource).not.toContain("async function composePostLoginRuntime(");
    expect(mainSource).not.toContain("function createOnDemandFeatureCompositionPaths(");
    expect(mainSource).not.toContain("async function bootstrapPostLoginRuntime(");
    expect(bootstrapperSource).toContain("async function composePostLoginRuntime(");
    expect(bootstrapperSource).toContain("function createOnDemandFeatureCompositionPaths(");
    expect(bootstrapperSource).toContain("async function ensureDeferredDesktopFeatureRuntimeFactory()");
    expect(bootstrapperSource).toContain("const runtimeComposition = await composePostLoginRuntime(");
    expect(bootstrapperSource).toContain("await import(\"../DeferredDesktopFeatureRuntime\")");
    expect(bootstrapperSource).toContain("const pythonRuntime = resolveDesktopPythonRuntime(");
    expect(bootstrapperSource).toContain("const serviceSupervisor = new DesktopServiceSupervisor(");
    expect(bootstrapperSource).toContain("await serviceSupervisor.start()");
    expect(mainSource).toContain("connectivityRuntimeController.startMonitoring(authShell.identityApiBaseUrl)");
  });

  it("keeps legacy eager bootstrap entrypoint removed", () => {
    expect(mainSource).not.toContain("bootstrapDesktopRuntime(");
  });
});
