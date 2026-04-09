import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import { HostDeploymentProfileIds, HostStartupEnvironmentKeys } from "@infrastructure/config/HostStartupConfiguration";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { createAuthoritativeServerConfigBootstrapStage } from "../AuthoritativeServerConfigBootstrapStage";

describe("AuthoritativeServerConfigBootstrapStage", () => {
  it("resolves startup configuration and runtime metadata independently", async () => {
    const stage = createAuthoritativeServerConfigBootstrapStage({
      startup: {
        deploymentProfile: {
          profileId: HostDeploymentProfileIds.organization,
          environmentName: "production",
          releaseChannel: "stable",
        },
      },
    });
    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-config-stage-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const output = await stage.execute({
      boot,
      startupReason: boot.startupReason,
      environment: Object.freeze({
        [HostStartupEnvironmentKeys.environmentName]: "staging",
      }),
      hostConfiguration: Object.freeze({
        databasePath: "test.sqlite",
        host: "127.0.0.1",
        port: 6123,
      }),
    });

    expect(output.deploymentProfile.profileId).toBe(HostDeploymentProfileIds.organization);
    expect(output.environment[HostStartupEnvironmentKeys.environmentName]).toBe("staging");
    expect(output.enabledCapabilities).toContain("control-plane-authority");
    expect(output.runtimeMetadata.hostId).toBe("host:server:authoritative");
    expect(output.runtimeMetadata.metadata.startupReason).toBe("authoritative-server-config-stage-test");
    expect(output.runtimeMetadata.metadata.transportHost).toBe("127.0.0.1");
    expect(output.runtimeMetadata.metadata.transportPort).toBe("6123");
  });
});
