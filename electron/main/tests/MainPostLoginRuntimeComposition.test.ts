import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const dependencyActivatorSource = fs.readFileSync(
  path.resolve(process.cwd(), "electron/main/runtime/PostLoginRuntimeDependencyActivator.ts"),
  "utf8",
);
const activationServiceSource = fs.readFileSync(
  path.resolve(process.cwd(), "electron/main/runtime/PostLoginRuntimeActivationService.ts"),
  "utf8",
);

describe("electron main post-login runtime composition", () => {
  it("delegates post-login runtime composition to dedicated activation service and dependency activator modules", () => {
    expect(mainSource).toContain("createPostLoginRuntimeDependencyActivator({");
    expect(mainSource).toContain("createPostLoginRuntimeActivationService({");
    expect(mainSource).toContain("postLoginRuntimeActivationService.startPostLoginWarmup(request)");
    expect(mainSource).not.toContain("async function composePostLoginRuntimeDependencies(");
    expect(mainSource).not.toContain("function createOnDemandFeatureCompositionPaths(");
    expect(mainSource).not.toContain("async function activatePostLoginRuntimeDependencies(");
    expect(dependencyActivatorSource).toContain("async function composePostLoginRuntimeDependencies(");
    expect(dependencyActivatorSource).toContain("function createOnDemandFeatureCompositionPaths(");
    expect(dependencyActivatorSource).toContain("async function ensureDeferredDesktopFeatureRuntimeFactory()");
    expect(dependencyActivatorSource).toContain("const runtimeComposition = await composePostLoginRuntimeDependencies(");
    expect(dependencyActivatorSource).toContain("await import(\"../DeferredDesktopFeatureRuntime\")");
    expect(dependencyActivatorSource).toContain("const pythonRuntime = resolvePythonRuntimeActivationStage(");
    expect(dependencyActivatorSource).toContain("const serviceSupervisor = new DesktopServiceSupervisor(");
    expect(dependencyActivatorSource).toContain("startServiceSupervisorActivationStage({");
    expect(dependencyActivatorSource).toContain("postLoginRuntimeStatusStore: params.postLoginRuntimeStatusStore");
    expect(activationServiceSource).toContain("controlPlaneRuntime.activateCapabilities(");
    expect(activationServiceSource).toContain("AuthoritativeServerCapabilityIds.deferredRuntimeFeatures");
    expect(mainSource).not.toContain("promoteControlPlaneRuntimeForPostLogin");
    expect(activationServiceSource).toContain("connectivityRuntimeController.startMonitoring(authShell.controlPlaneBaseUrl)");
  });

  it("keeps legacy eager bootstrap entrypoint removed", () => {
    expect(mainSource).not.toContain("bootstrapDesktopRuntime(");
  });
});
