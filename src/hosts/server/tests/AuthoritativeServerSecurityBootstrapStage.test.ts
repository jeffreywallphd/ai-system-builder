import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import { createHostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import { createStartupTracer } from "@hosts/bootstrap/startupTracer";
import { advertiseHostRuntimeMetadata } from "@hosts/HostRuntimeMetadataCatalog";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { createAuthoritativeServerSecurityBootstrapStage } from "../AuthoritativeServerSecurityBootstrapStage";
import { AuthoritativeServerReadinessCheckStates } from "../AuthoritativeServerBootstrapStageContracts";

describe("AuthoritativeServerSecurityBootstrapStage", () => {
  it("returns readiness defaults when no custom checks are configured", async () => {
    const stage = createAuthoritativeServerSecurityBootstrapStage();
    const output = await stage.execute({
      deploymentProfile: createHostDeploymentProfile({
        profileId: "home",
        environmentName: "development",
        releaseChannel: "dev",
      }),
      environment: Object.freeze({ NODE_ENV: "test" }),
      enabledCapabilities: AuthoritativeServerHostRuntime.capabilities,
      runtimeMetadata: advertiseHostRuntimeMetadata({
        host: AuthoritativeServerHostRuntime,
      }),
      startupTracer: createStartupTracer({
        startupReason: "authoritative-server-security-stage-test",
      }),
      hostConfiguration: Object.freeze({
        databasePath: "test.sqlite",
      }),
    });

    expect(output.checks).toEqual([
      {
        checkId: "security.transport-trust-material",
        subsystem: "security",
        state: AuthoritativeServerReadinessCheckStates.ready,
        summary: "Transport trust material is available.",
        blocking: false,
      },
      {
        checkId: "security.certificate-authority-material",
        subsystem: "security",
        state: AuthoritativeServerReadinessCheckStates.ready,
        summary: "Certificate authority material is available.",
        blocking: false,
      },
      {
        checkId: "security.required-secrets",
        subsystem: "security",
        state: AuthoritativeServerReadinessCheckStates.ready,
        summary: "Required secret material is validated.",
        blocking: false,
      },
    ]);
  });

  it("supports explicit readiness checks for independent stage execution", async () => {
    const calls: string[] = [];
    const stage = createAuthoritativeServerSecurityBootstrapStage({
      resolveTransportTrustReady: () => {
        calls.push("transport");
        return true;
      },
      resolveCertificateAuthorityReady: () => {
        calls.push("ca");
        return true;
      },
      validateRequiredSecrets: () => {
        calls.push("secrets");
        return false;
      },
    });
    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-security-stage-custom-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const output = await stage.execute({
      deploymentProfile: createHostDeploymentProfile({
        profileId: "home",
        environmentName: "development",
        releaseChannel: "dev",
      }),
      environment: boot.environment,
      enabledCapabilities: boot.host.capabilities,
      runtimeMetadata: advertiseHostRuntimeMetadata({
        host: boot.host,
      }),
      startupTracer: createStartupTracer({
        startupReason: boot.startupReason,
      }),
      hostConfiguration: Object.freeze({
        databasePath: "test.sqlite",
      }),
    });

    expect(calls).toEqual(["transport", "ca", "secrets"]);
    expect(output.checks.map((check) => check.checkId)).toEqual([
      "security.transport-trust-material",
      "security.certificate-authority-material",
      "security.required-secrets",
    ]);
    expect(output.checks[0]?.state).toBe(AuthoritativeServerReadinessCheckStates.ready);
    expect(output.checks[1]?.state).toBe(AuthoritativeServerReadinessCheckStates.ready);
    expect(output.checks[2]?.state).toBe(AuthoritativeServerReadinessCheckStates.degraded);
  });
});
