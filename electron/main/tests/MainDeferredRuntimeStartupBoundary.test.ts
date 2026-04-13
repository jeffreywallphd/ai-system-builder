import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const bootstrapperSource = fs.readFileSync(
  path.resolve(process.cwd(), "electron/main/runtime/PostLoginRuntimeBootstrapper.ts"),
  "utf8",
);

function extractFunctionSource(startMarker: string, endMarker: string): string {
  const start = mainSource.indexOf(startMarker);
  const end = mainSource.indexOf(endMarker);
  if (start < 0 || end <= start) {
    return "";
  }
  return mainSource.slice(start, end);
}

const bootstrapAuthShellSource = extractFunctionSource(
  "async function bootstrapAuthShell()",
  "const postLoginRuntimeBootstrapper = createPostLoginRuntimeBootstrapper({",
);
const warmupEntrySource = extractFunctionSource(
  "async function ensurePostLoginWarmupStarted(request: DesktopPostLoginWarmupRequest): Promise<void> {",
  "registerDesktopAppLifecycle({",
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
    expect(warmupEntrySource).toContain("connectivityRuntimeController.startMonitoring(authShell.identityApiBaseUrl)");
    expect(warmupEntrySource).not.toContain("bootstrapAuthShell");
  });

  it("activates post-login capabilities on the already-bound control-plane host without rebinding", () => {
    expect(warmupEntrySource).toContain("persistent control-plane host");
    expect(warmupEntrySource).not.toContain("startAuthoritativeServerHostAssembly");
    expect(warmupEntrySource).not.toContain("markTransportBinding");
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
    expect(bootstrapperSource).toContain("async function composePostLoginRuntime(");
    expect(bootstrapperSource).toContain("resolveDesktopPythonRuntime(");
    expect(bootstrapperSource).toContain("const serviceSupervisor = new DesktopServiceSupervisor(");
    expect(bootstrapperSource).toContain("await serviceSupervisor.start()");
  });

  it("keeps workflow/studio/system backend activation on-demand via deferred runtime container", () => {
    expect(bootstrapperSource).toContain("function createOnDemandFeatureCompositionPaths(");
    expect(bootstrapperSource).toContain("getWorkflowPersistence: () => params.featureRuntime.ensureWorkflowPersistence()");
    expect(bootstrapperSource).toContain("getExecutionHistory: () => params.featureRuntime.ensureExecutionHistory()");
    expect(bootstrapperSource).toContain("getWorkflowRunHistory: () => params.featureRuntime.ensureWorkflowRunHistory()");
    expect(bootstrapperSource).toContain("getStudioShellBackendApi: () => params.featureRuntime.ensureStudioShellBackendApi()");
    expect(bootstrapperSource).toContain("getSystemStudioBackendApi: () => params.featureRuntime.ensureSystemStudioBackendApi()");
    expect(bootstrapperSource).toContain("getSystemRuntimeBackendApi: () => params.featureRuntime.ensureSystemRuntimeBackendApi()");
    expect(bootstrapperSource).toContain("getCanonicalRegistryRuntime: () => params.canonicalRegistryRuntimeProvider.ensureCanonicalRegistryRuntime()");
    expect(bootstrapperSource).toContain("getAgentStudioBackendApi: () => params.agentRuntimeProvider.ensureAgentStudioBackendApi()");
  });
});
