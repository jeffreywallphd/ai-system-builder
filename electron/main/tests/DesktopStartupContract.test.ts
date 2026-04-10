import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import {
  DesktopStartupBootSequence,
  DesktopStartupBootStepIds,
  DesktopStartupRequiredAuthBootstrapIpcChannels,
  PreLoginAuthShellForbiddenInitializers,
  PreLoginAuthShellInitializers,
  validateDesktopStartupContract,
} from "../DesktopStartupContract";
import { DesktopBootstrapIpcChannels } from "../../shared/DesktopBootstrapIpcChannels";

describe("desktop startup boot contract", () => {
  it("keeps main-window creation ahead of service supervisor startup", () => {
    const mainWindowIndex = DesktopStartupBootSequence.indexOf(DesktopStartupBootStepIds.mainWindowCreation);
    const supervisorIndex = DesktopStartupBootSequence.indexOf(DesktopStartupBootStepIds.serviceSupervisorStartup);
    expect(mainWindowIndex).toBeGreaterThan(-1);
    expect(supervisorIndex).toBeGreaterThan(-1);
    expect(mainWindowIndex).toBeLessThan(supervisorIndex);
  });

  it("keeps pre-login initializers free of workflow/studio/system runtime dependencies", () => {
    const forbidden = new Set(PreLoginAuthShellForbiddenInitializers);
    const violations = PreLoginAuthShellInitializers.filter((initializer) => forbidden.has(initializer));
    expect(violations).toEqual([]);
    expect(PreLoginAuthShellInitializers).toContain("auth-minimal-identity-host");
    expect(PreLoginAuthShellInitializers).not.toContain("authoritative-identity-host");
  });

  it("requires auth bootstrap channels used by preload sync bootstrap", () => {
    expect(DesktopStartupRequiredAuthBootstrapIpcChannels).toContain(DesktopBootstrapIpcChannels.bootstrap);
    const preloadSource = fs.readFileSync(path.resolve(process.cwd(), "electron/preload.ts"), "utf8");
    expect(preloadSource).toContain("ipcRenderer.sendSync(DesktopBootstrapIpcChannels.bootstrap)");
  });

  it("validates the aggregate startup boot contract", () => {
    expect(() => validateDesktopStartupContract()).not.toThrow();
  });
});

