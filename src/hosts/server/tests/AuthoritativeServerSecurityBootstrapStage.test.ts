import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import { createHostDeploymentProfile } from "@hosts/bootstrap/HostBootstrapPipeline";
import { createStartupTracer } from "@hosts/bootstrap/startupTracer";
import { advertiseHostRuntimeMetadata } from "@hosts/HostRuntimeMetadataCatalog";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import {
  AuthoritativeServerStartupSecurityMaterialValidationError,
  createAuthoritativeServerSecurityBootstrapStage,
} from "../AuthoritativeServerSecurityBootstrapStage";
import {
  AuthoritativeServerSecurityMaterialReadinessStates,
  AuthoritativeServerReadinessCheckStates,
} from "../AuthoritativeServerBootstrapStageContracts";

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
        checkId: "security.startup-material-validation",
        subsystem: "security",
        state: AuthoritativeServerReadinessCheckStates.ready,
        summary: "Startup security material validation produced 1 diagnostic issue(s).",
        blocking: false,
        details: {
          lifecycleStage: "test",
          fatalIssueCount: "0",
          warningCount: "1",
          productionCapable: "false",
        },
      },
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
    expect(output.securityMaterial.state).toBe(AuthoritativeServerSecurityMaterialReadinessStates.degraded);
    expect(output.securityMaterial.warningIssueCount).toBe(1);
    expect(output.securityMaterial.summary.total).toBeGreaterThanOrEqual(1);
    expect(output.securityMaterial.issues.every((issue) => issue.message.includes("Security material"))).toBeTrue();
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
      "security.startup-material-validation",
      "security.transport-trust-material",
      "security.certificate-authority-material",
      "security.required-secrets",
    ]);
    expect(output.checks[1]?.state).toBe(AuthoritativeServerReadinessCheckStates.ready);
    expect(output.checks[2]?.state).toBe(AuthoritativeServerReadinessCheckStates.ready);
    expect(output.checks[3]?.state).toBe(AuthoritativeServerReadinessCheckStates.degraded);
    expect(output.securityMaterial.state).toBe(AuthoritativeServerSecurityMaterialReadinessStates.degraded);
  });

  it("fails fast when startup security material validation reports fatal diagnostics", async () => {
    const stage = createAuthoritativeServerSecurityBootstrapStage({
      validateStartupSecurityMaterial: () => Object.freeze({
        state: "invalid" as const,
        lifecycleStage: "production" as const,
        productionCapable: true,
        observations: Object.freeze([]),
        issues: Object.freeze([{
          materialId: "material:test:fatal",
          code: "missing" as const,
          severity: "fatal" as const,
          message: "Required security material is missing.",
          sourceKind: "missing" as const,
        }]),
        fatalIssues: Object.freeze([{
          materialId: "material:test:fatal",
          code: "missing" as const,
          severity: "fatal" as const,
          message: "Required security material is missing.",
          sourceKind: "missing" as const,
        }]),
        warnings: Object.freeze([]),
      }),
    });

    try {
      await stage.execute({
        deploymentProfile: createHostDeploymentProfile({
          profileId: "organization",
          environmentName: "production",
          releaseChannel: "stable",
        }),
        environment: Object.freeze({ NODE_ENV: "production" }),
        enabledCapabilities: AuthoritativeServerHostRuntime.capabilities,
        runtimeMetadata: advertiseHostRuntimeMetadata({
          host: AuthoritativeServerHostRuntime,
        }),
        startupTracer: createStartupTracer({
          startupReason: "authoritative-server-security-stage-fail-fast-test",
        }),
        hostConfiguration: Object.freeze({
          databasePath: "test.sqlite",
        }),
      });
      throw new Error("Expected startup validation to fail fast.");
    } catch (error) {
      expect(error).toBeInstanceOf(AuthoritativeServerStartupSecurityMaterialValidationError);
      const failure = error as AuthoritativeServerStartupSecurityMaterialValidationError;
      expect(failure.securityMaterial.state).toBe(AuthoritativeServerSecurityMaterialReadinessStates.blocked);
      expect(failure.securityMaterial.blocking).toBeTrue();
      expect(failure.securityMaterial.fatalIssueCount).toBe(1);
      expect(failure.readinessChecks).toHaveLength(1);
      expect(failure.readinessChecks[0]?.checkId).toBe("security.startup-material-validation");
      expect(failure.readinessChecks[0]?.blocking).toBeTrue();
    }
  });
});
