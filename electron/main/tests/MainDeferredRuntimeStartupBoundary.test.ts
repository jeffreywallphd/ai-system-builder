import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");

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
  "function registerDeferredFeatureIpc(register: () => void): void {",
);
const warmupEntrySource = extractFunctionSource(
  "async function ensurePostLoginWarmupStarted(request: DesktopPostLoginWarmupRequest): Promise<void> {",
  "type PostLoginRuntimeComposition = {",
);
const composePostLoginRuntimeSource = extractFunctionSource(
  "async function composePostLoginRuntime(authShell: AuthShellBootstrapResult, bootstrapStartedAt: number): Promise<PostLoginRuntimeComposition> {",
  "function createOnDemandFeatureCompositionPaths(params: {",
);
const onDemandRuntimeSource = extractFunctionSource(
  "function createOnDemandFeatureCompositionPaths(params: {",
  "async function bootstrapPostLoginRuntime(authShell: AuthShellBootstrapResult): Promise<void> {",
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
    expect(warmupEntrySource).toContain("startDesktopConnectivityMonitoring(authShell.identityApiBaseUrl)");
    expect(warmupEntrySource).not.toContain("bootstrapAuthShell");
  });

  it("keeps python runtime resolution and service supervisor startup in post-login runtime composition", () => {
    expect(composePostLoginRuntimeSource).toContain("resolveDesktopPythonRuntime(");
    expect(composePostLoginRuntimeSource).toContain("serviceSupervisor = new DesktopServiceSupervisor(");
    expect(composePostLoginRuntimeSource).toContain("await serviceSupervisor.start()");
  });

  it("keeps workflow/studio/system backend activation on-demand via deferred runtime container", () => {
    expect(onDemandRuntimeSource).toContain("getWorkflowPersistence: () => params.featureRuntime.ensureWorkflowPersistence()");
    expect(onDemandRuntimeSource).toContain("getExecutionHistory: () => params.featureRuntime.ensureExecutionHistory()");
    expect(onDemandRuntimeSource).toContain("getWorkflowRunHistory: () => params.featureRuntime.ensureWorkflowRunHistory()");
    expect(onDemandRuntimeSource).toContain("getStudioShellBackendApi: () => params.featureRuntime.ensureStudioShellBackendApi()");
    expect(onDemandRuntimeSource).toContain("getSystemStudioBackendApi: () => params.featureRuntime.ensureSystemStudioBackendApi()");
    expect(onDemandRuntimeSource).toContain("getSystemRuntimeBackendApi: () => params.featureRuntime.ensureSystemRuntimeBackendApi()");
  });
});
