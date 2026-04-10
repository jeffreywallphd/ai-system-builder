import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  DesktopStartupBootSequence,
  DesktopStartupBootStepIds,
  DesktopPostLoginWarmupSequence,
  DesktopPostLoginWarmupStepIds,
  DesktopStartupRequiredAuthBootstrapIpcChannels,
  PreLoginAuthShellForbiddenInitializers,
  PreLoginAuthShellInitializers,
  validateDesktopStartupContract,
} from "../DesktopStartupContract";
import { DesktopBootstrapIpcChannels } from "../../shared/DesktopBootstrapIpcChannels";

describe("desktop startup boot contract", () => {
  it("keeps pre-login boot sequence limited to auth-shell startup", () => {
    const mainWindowIndex = DesktopStartupBootSequence.indexOf(DesktopStartupBootStepIds.mainWindowCreation);
    expect(mainWindowIndex).toBeGreaterThan(-1);
    expect(DesktopStartupBootSequence).not.toContain(DesktopPostLoginWarmupStepIds.pythonRuntimeResolution);
    expect(DesktopStartupBootSequence).not.toContain(DesktopPostLoginWarmupStepIds.serviceSupervisorStartup);
  });

  it("keeps python resolution and supervisor startup in post-login warmup sequence", () => {
    expect(DesktopPostLoginWarmupSequence).toEqual([
      DesktopPostLoginWarmupStepIds.pythonRuntimeResolution,
      DesktopPostLoginWarmupStepIds.serviceSupervisorStartup,
      DesktopPostLoginWarmupStepIds.deferredFeatureRegistration,
    ]);
  });

  it("keeps pre-login initializers free of workflow/studio/system runtime dependencies", () => {
    const forbidden = new Set(PreLoginAuthShellForbiddenInitializers);
    const violations = PreLoginAuthShellInitializers.filter((initializer) => forbidden.has(initializer));
    expect(violations).toEqual([]);
    expect(PreLoginAuthShellInitializers).toContain("auth-minimal-identity-host");
    expect(PreLoginAuthShellInitializers).not.toContain("desktop-connectivity-monitor");
    expect(PreLoginAuthShellInitializers).not.toContain("authoritative-identity-host");
  });

  it("requires auth bootstrap channels used by preload sync bootstrap", () => {
    expect(DesktopStartupRequiredAuthBootstrapIpcChannels).toContain(DesktopBootstrapIpcChannels.bootstrap);
    expect(DesktopStartupRequiredAuthBootstrapIpcChannels).toContain(DesktopBootstrapIpcChannels.postLoginRuntimeStatus);
    const preloadSource = fs.readFileSync(path.resolve(process.cwd(), "electron/preload.ts"), "utf8");
    expect(preloadSource).toContain("ipcRenderer.sendSync(DesktopBootstrapIpcChannels.bootstrap)");
    expect(preloadSource).toContain("ipcRenderer.sendSync(DesktopBootstrapIpcChannels.postLoginRuntimeStatus)");
  });

  it("validates the aggregate startup boot contract", () => {
    expect(() => validateDesktopStartupContract()).not.toThrow();
  });
});

