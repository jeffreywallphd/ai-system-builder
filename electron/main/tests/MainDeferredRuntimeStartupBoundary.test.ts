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

function extractFunctionSource(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start < 0 || end <= start) {
    return "";
  }
  return source.slice(start, end);
}

const bootstrapAuthShellSource = extractFunctionSource(
  mainSource,
  "async function bootstrapAuthShell()",
  "const postLoginRuntimeDependencyActivator = createPostLoginRuntimeDependencyActivator({",
);
const warmupEntrySource = extractFunctionSource(
  activationServiceSource,
  "async function startPostLoginWarmup(request: DesktopPostLoginWarmupRequest): Promise<void> {",
  "  return Object.freeze({",
);

describe("electron main deferred runtime startup boundary", () => {
  it("keeps pre-login auth-shell startup free of deferred runtime activation", () => {
    expect(bootstrapAuthShellSource).not.toContain("resolveDesktopPythonRuntime(");
    expect(bootstrapAuthShellSource).not.toContain("DesktopServiceSupervisor(");
    expect(bootstrapAuthShellSource).not.toContain("serviceSupervisor.start(");
    expect(bootstrapAuthShellSource).not.toContain("startDesktopConnectivityMonitoring(");
    expect(bootstrapAuthShellSource).not.toContain("ensureWorkflowPersistence(");
    expect(bootstrapAuthShellSource).not.toContain("ensureExecutionHistory(");
    expect(bootstrapAuthShellSource).not.toContain("ensureWorkflowRunHistory(");
    expect(bootstrapAuthShellSource).not.toContain("ensureStudioShellBackendApi(");
    expect(bootstrapAuthShellSource).not.toContain("ensureSystemStudioBackendApi(");
    expect(bootstrapAuthShellSource).not.toContain("ensureSystemRuntimeBackendApi(");
  });

  it("starts connectivity monitoring only when post-login warmup is accepted", () => {
    expect(warmupEntrySource).toContain("connectivityRuntimeController.startMonitoring(authShell.controlPlaneBaseUrl)");
    expect(warmupEntrySource).not.toContain("bootstrapAuthShell");
  });

  it("activates post-login capabilities on the already-bound control-plane host without rebinding", () => {
    expect(warmupEntrySource).toContain("persistent control-plane host");
    expect(warmupEntrySource).toContain("controlPlaneRuntime.activateCapabilities(");
    expect(warmupEntrySource).toContain("AuthoritativeServerCapabilityIds.deferredRuntimeFeatures");
    expect(warmupEntrySource).not.toContain("ensureDesktopControlPlaneHostBound(");
    expect(warmupEntrySource).not.toContain("startAuthoritativeServerHostAssembly");
    expect(warmupEntrySource).not.toContain("markTransportBinding");
    expect(warmupEntrySource).not.toContain("markTransportAvailable");
    expect(warmupEntrySource).not.toContain("markTransportUnavailable");
  });

  it("keeps a single authoritative host composition path and removes host promotion handoff", () => {
    expect(mainSource).not.toContain("promoteControlPlaneRuntimeForPostLogin");
    expect(mainSource).not.toContain("startAuthMinimalServerHostAssembly");
    expect(mainSource).not.toContain("authoritative-host-promotion-bind-start");
    expect(mainSource).not.toContain("authoritative-host-promotion-bind-ready");
    expect(mainSource).toContain("authoritative-host-bind-start");
    expect(mainSource).toContain("authoritative-host-bind-ready");
  });
  it("keeps python runtime resolution and service supervisor startup in post-login runtime composition", () => {
    expect(dependencyActivatorSource).toContain("async function composePostLoginRuntimeDependencies(");
    expect(dependencyActivatorSource).toContain("resolvePythonRuntimeActivationStage(");
    expect(dependencyActivatorSource).toContain("const serviceSupervisor = new DesktopServiceSupervisor(");
    expect(dependencyActivatorSource).toContain("startServiceSupervisorActivationStage({");
    expect(dependencyActivatorSource).toContain("postLoginRuntimeStatusStore: params.postLoginRuntimeStatusStore");
  });

  it("keeps workflow/studio/system backend activation on-demand via deferred runtime container", () => {
    expect(dependencyActivatorSource).toContain("function createOnDemandFeatureCompositionPaths(");
    expect(dependencyActivatorSource).toContain("getWorkflowPersistence: () => params.featureRuntime.ensureWorkflowPersistence()");
    expect(dependencyActivatorSource).toContain("getExecutionHistory: () => params.featureRuntime.ensureExecutionHistory()");
    expect(dependencyActivatorSource).toContain("getWorkflowRunHistory: () => params.featureRuntime.ensureWorkflowRunHistory()");
    expect(dependencyActivatorSource).toContain("getStudioShellBackendApi: () => params.featureRuntime.ensureStudioShellBackendApi()");
    expect(dependencyActivatorSource).toContain("getSystemStudioBackendApi: () => params.featureRuntime.ensureSystemStudioBackendApi()");
    expect(dependencyActivatorSource).toContain("getSystemRuntimeBackendApi: () => params.featureRuntime.ensureSystemRuntimeBackendApi()");
    expect(dependencyActivatorSource).toContain("getCanonicalRegistryRuntime: () => params.canonicalRegistryRuntimeProvider.ensureCanonicalRegistryRuntime()");
    expect(dependencyActivatorSource).toContain("getAgentStudioBackendApi: () => params.agentRuntimeProvider.ensureAgentStudioBackendApi()");
  });
});
