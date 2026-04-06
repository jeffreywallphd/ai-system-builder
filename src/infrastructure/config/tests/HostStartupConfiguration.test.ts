import { describe, expect, it } from "bun:test";
import { HostCapabilityFlags } from "../../../domain/hosts/HostRuntimeDomain";
import { createHostBootConfiguration } from "../../../application/common/HostCompositionContracts";
import { HybridHostRuntime } from "../../../hosts/HostRuntimeCatalog";
import {
  HostDeploymentProfileIds,
  HostStartupConfigurationError,
  HostStartupEnvironmentKeys,
  resolveHostStartupConfiguration,
} from "../HostStartupConfiguration";

describe("HostStartupConfiguration", () => {
  it("resolves profile-aware startup settings from environment", () => {
    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "startup-config-env-resolution-test",
      environment: {
        NODE_ENV: "production",
        [HostStartupEnvironmentKeys.deploymentProfile]: "classroom",
        [HostStartupEnvironmentKeys.releaseChannel]: "stable",
        [HostStartupEnvironmentKeys.region]: "us-east-1",
      },
    });

    const resolved = resolveHostStartupConfiguration({
      boot,
    });

    expect(resolved.deploymentProfile.profileId).toBe(HostDeploymentProfileIds.classroom);
    expect(resolved.deploymentProfile.environmentName).toBe("production");
    expect(resolved.deploymentProfile.releaseChannel).toBe("stable");
    expect(resolved.deploymentProfile.region).toBe("us-east-1");
    expect(resolved.enabledCapabilities).toContain(HostCapabilityFlags.nodeExecution);
    expect(resolved.enabledCapabilities).toContain(HostCapabilityFlags.workerRuntime);
  });

  it("supports explicit startup overrides and validates enabled capabilities", () => {
    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "startup-config-override-test",
      environment: {
        NODE_ENV: "development",
        [HostStartupEnvironmentKeys.deploymentProfile]: "organization",
      },
    });

    const resolved = resolveHostStartupConfiguration({
      boot,
      startup: {
        deploymentProfile: {
          profileId: "home",
          environmentName: "test",
          releaseChannel: "ci",
        },
        enabledCapabilities: [
          HostCapabilityFlags.desktopShell,
          HostCapabilityFlags.userInterfaceRendering,
        ],
      },
    });

    expect(resolved.deploymentProfile.profileId).toBe(HostDeploymentProfileIds.home);
    expect(resolved.deploymentProfile.environmentName).toBe("test");
    expect(resolved.deploymentProfile.releaseChannel).toBe("ci");
    expect(resolved.enabledCapabilities).toEqual([
      HostCapabilityFlags.desktopShell,
      HostCapabilityFlags.userInterfaceRendering,
    ]);
  });

  it("rejects unsupported deployment profiles", () => {
    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "startup-config-invalid-profile-test",
      environment: {
        [HostStartupEnvironmentKeys.deploymentProfile]: "enterprise",
      },
    });

    expect(() => resolveHostStartupConfiguration({
      boot,
    })).toThrow(HostStartupConfigurationError);
  });

  it("rejects enabled capabilities outside the host boundary", () => {
    const boot = createHostBootConfiguration({
      host: HybridHostRuntime,
      mode: "cold-start",
      startupReason: "startup-config-invalid-capability-test",
      environment: {
        [HostStartupEnvironmentKeys.enabledCapabilities]: HostCapabilityFlags.browserRuntime,
      },
    });

    expect(() => resolveHostStartupConfiguration({
      boot,
    })).toThrow(HostStartupConfigurationError);
  });
});
