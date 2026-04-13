import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");
const bootstrapperSource = fs.readFileSync(
  path.resolve(process.cwd(), "electron/main/runtime/PostLoginRuntimeBootstrapper.ts"),
  "utf8",
);
const deferredRuntimeSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/DeferredDesktopFeatureRuntime.ts"), "utf8");

describe("desktop startup instrumentation coverage", () => {
  it("keeps explicit pre-login, authoritative control-plane host, first-window, and post-login warmup checkpoints", () => {
    expect(mainSource).toContain("DesktopStartupPhases.preLoginAuthShellBootstrap");
    expect(mainSource).toContain("DesktopStartupPhases.identityAuthHostReadiness");
    expect(mainSource).toContain("first-window-ready-to-show");
    expect(mainSource).toContain("renderer-first-window-ready");
    expect(bootstrapperSource).toContain("DesktopStartupPhases.postLoginWarmup");
    expect(bootstrapperSource).toContain("deferred-feature-runtime-container-ready");
  });

  it("keeps deferred runtime service-group timing and memory instrumentation", () => {
    expect(deferredRuntimeSource).toContain("desktop-startup.deferred-feature-runtime.workflow-persistence");
    expect(deferredRuntimeSource).toContain("desktop-startup.deferred-feature-runtime.studio-shell-backend-api");
    expect(deferredRuntimeSource).toContain("desktop-startup.deferred-feature-runtime.system-runtime-backend-api");
    expect(deferredRuntimeSource).toContain("workflow-persistence-ready");
    expect(deferredRuntimeSource).toContain("studio-shell-backend-api-ready");
    expect(deferredRuntimeSource).toContain("system-runtime-backend-api-ready");
  });
});
