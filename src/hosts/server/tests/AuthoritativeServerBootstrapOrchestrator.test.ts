import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import {
  HostStartupDependencyBoundaryLayers,
  type HostServiceRegistrationDefinition,
  type HostStartupDependencyBoundaryLayer,
} from "@domain/hosts/HostRuntimeDomain";
import {
  HostComposableServiceKinds,
  type HostServiceRegistrationPlan,
} from "@infrastructure/config/HostServiceRegistration";
import { HostDeploymentProfileIds } from "@infrastructure/config/HostStartupConfiguration";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { SqlitePersistenceRuntime } from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { createAuthoritativeServerConfigBootstrapStage } from "../AuthoritativeServerConfigBootstrapStage";
import { createAuthoritativeServerSecurityBootstrapStage } from "../AuthoritativeServerSecurityBootstrapStage";
import {
  createAuthoritativeServerBootstrapOrchestrator,
} from "../AuthoritativeServerBootstrapOrchestrator";
import {
  composeAuthoritativeServerApiRouteRegistrationPlan,
} from "../AuthoritativeServerApiRouteComposition";
import {
  AuthoritativeServerCompositionModuleIds,
} from "../composition/contracts/AuthoritativeServerCompositionModuleContracts";

function createDeploymentPolicyBootstrapResolutionStub(
  profileId = HostDeploymentProfileIds.home,
): DeploymentPolicyBootstrapResolutionResult {
  const context = Object.freeze({
    profileId,
  });
  return Object.freeze({
    scope: Object.freeze({
      kind: "deployment-policy-scope",
      scopeId: "platform:default",
    }),
    activeProfile: Object.freeze({
      profileId,
      source: "default-fallback",
    }),
    overrideRecords: Object.freeze([]),
    evaluationContext: context,
    evaluationService: {} as never,
    snapshot: {} as never,
    validation: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
      evaluatedAt: "2026-04-06T00:00:00.000Z",
    }),
    contextResolver: Object.freeze({
      resolveContext: async () => context,
    }),
  });
}

function createServicePlan(): HostServiceRegistrationPlan {
  const selectedService = Object.freeze({
    serviceId: "service:control-plane-ready",
    description: "Stub control-plane startup service for orchestrator composition tests.",
    kind: HostComposableServiceKinds.applicationPort,
    boundaryLayer: HostStartupDependencyBoundaryLayers.application,
    startupDependencyIds: Object.freeze(["dep:application:control-plane-services"]),
    requiredCapabilities: Object.freeze([]),
    allowedControlPlaneRoles: Object.freeze([]),
    exposureBoundaries: Object.freeze([]),
    dependsOn: Object.freeze([]),
  } satisfies HostServiceRegistrationDefinition);

  return Object.freeze({
    hostId: AuthoritativeServerHostRuntime.hostId,
    selectedServices: Object.freeze([selectedService]),
    startupDependencyCoverage: Object.freeze({
      "dep:application:control-plane-services": Object.freeze([selectedService.serviceId]),
    }),
    servicesByLayer: Object.freeze({
      [HostStartupDependencyBoundaryLayers.sharedContracts]: Object.freeze([]),
      [HostStartupDependencyBoundaryLayers.domain]: Object.freeze([]),
      [HostStartupDependencyBoundaryLayers.application]: Object.freeze([selectedService.serviceId]),
      [HostStartupDependencyBoundaryLayers.infrastructure]: Object.freeze([]),
      [HostStartupDependencyBoundaryLayers.host]: Object.freeze([]),
    } satisfies Record<HostStartupDependencyBoundaryLayer, ReadonlyArray<string>>),
  });
}

describe("AuthoritativeServerBootstrapOrchestrator", () => {
  it("wires staged startup composition and returns ready stage/readiness output", async () => {
    const startedHostOptions: Array<Readonly<Record<string, unknown>>> = [];
    const routePlan = composeAuthoritativeServerApiRouteRegistrationPlan();

    const orchestrator = createAuthoritativeServerBootstrapOrchestrator({
      boot: createHostBootConfiguration({
        host: AuthoritativeServerHostRuntime,
        mode: "cold-start",
        startupReason: "authoritative-server-bootstrap-orchestrator-success-test",
        requiredDependencyIds: ["dep:application:control-plane-services"],
      }),
      hostOptions: {
        databasePath: "bootstrap-orchestrator-success.sqlite",
      },
      startHost: async (options) => {
        startedHostOptions.push(options as Readonly<Record<string, unknown>>);
        return {
          port: 6020,
          address: "127.0.0.1:6020",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        createConfigStage: () => createAuthoritativeServerConfigBootstrapStage(),
        createSecurityStage: () => createAuthoritativeServerSecurityBootstrapStage(),
        composeServiceRegistrationPlan: () => createServicePlan(),
        composeApiRouteRegistrationPlan: () => routePlan,
        createPersistenceRuntime: () => Object.freeze({
          configuration: Object.freeze({
            databasePath: "bootstrap-orchestrator-success.sqlite",
            pragmas: Object.freeze({
              journalMode: "WAL",
              foreignKeys: true,
            }),
          }),
          start: async () => {},
          getConnection: () => {
            throw new Error("not-used");
          },
          dispose: async () => {},
        }) satisfies SqlitePersistenceRuntime,
        composePersistentPlatformServices: () => Object.freeze({
          dispose: () => {},
        }) as AuthoritativePersistentPlatformServices,
        resolveDeploymentPolicyBootstrap: async () => createDeploymentPolicyBootstrapResolutionStub(),
      },
    });

    const result = await orchestrator.execute();

    expect(startedHostOptions).toHaveLength(1);
    const startOptions = startedHostOptions[0]!;
    expect(startOptions.routeRegistrationPlan).toBe(routePlan);
    expect(startOptions.deploymentPolicyBootstrap).toBeDefined();
    expect(startOptions.persistentPlatformServices).toBeDefined();

    expect(result.stageStatus.stages.map((stage) => stage.stageId)).toEqual([
      "configuration-load",
      "security-material-resolution",
      "persistence-initialization",
      "migration-execution",
      "subsystem-composition",
      "readiness-verification",
      "transport-startup",
      "shutdown-preparation",
    ]);
    expect(result.stageStatus.stages.every((stage) => stage.state === "success")).toBeTrue();
    expect(result.stageStatus.readiness).toBe("ready");

    expect(result.readinessReport.state).toBe("ready");
    expect(result.readinessReport.checks.map((check) => check.checkId)).toContain("composition.service-coverage");
    expect(result.readinessReport.checks.map((check) => check.checkId)).toContain("composition.route-coverage");
    expect(result.readinessReport.checks.map((check) => check.checkId)).toContain("transport.binding");

    expect(result.shutdownDisposalPlan.steps.map((step) => step.moduleId)).toEqual([
      AuthoritativeServerCompositionModuleIds.transport,
      AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
    ]);
  });

  it("returns degraded readiness output while still completing startup when non-blocking checks degrade", async () => {
    const orchestrator = createAuthoritativeServerBootstrapOrchestrator({
      boot: createHostBootConfiguration({
        host: AuthoritativeServerHostRuntime,
        mode: "cold-start",
        startupReason: "authoritative-server-bootstrap-orchestrator-degraded-readiness-test",
        requiredDependencyIds: ["dep:application:control-plane-services"],
      }),
      hostOptions: {
        databasePath: "bootstrap-orchestrator-degraded.sqlite",
      },
      startHost: async () => ({
        port: 6021,
        address: "127.0.0.1:6021",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        createConfigStage: () => createAuthoritativeServerConfigBootstrapStage(),
        createSecurityStage: () => createAuthoritativeServerSecurityBootstrapStage({
          validateRequiredSecrets: () => false,
        }),
        composeServiceRegistrationPlan: () => createServicePlan(),
        composeApiRouteRegistrationPlan: () => composeAuthoritativeServerApiRouteRegistrationPlan(),
        createPersistenceRuntime: () => Object.freeze({
          configuration: Object.freeze({
            databasePath: "bootstrap-orchestrator-degraded.sqlite",
            pragmas: Object.freeze({
              journalMode: "WAL",
              foreignKeys: true,
            }),
          }),
          start: async () => {},
          getConnection: () => {
            throw new Error("not-used");
          },
          dispose: async () => {},
        }) satisfies SqlitePersistenceRuntime,
        composePersistentPlatformServices: () => Object.freeze({
          dispose: () => {},
        }) as AuthoritativePersistentPlatformServices,
        resolveDeploymentPolicyBootstrap: async () => createDeploymentPolicyBootstrapResolutionStub(),
      },
    });

    const result = await orchestrator.execute();

    expect(result.stageStatus.stages.every((stage) => stage.state === "success")).toBeTrue();
    expect(result.stageStatus.readiness).toBe("degraded");
    expect(result.readinessReport.state).toBe("degraded");
    expect(result.readinessReport.degradedCheckCount).toBeGreaterThanOrEqual(1);
    expect(result.readinessReport.checks.some((check) => (
      check.checkId === "security.required-secrets"
      && check.state === "degraded"
    ))).toBeTrue();
  });

  it("fails fast when required stage contracts are missing", async () => {
    const missingConfigOrchestrator = createAuthoritativeServerBootstrapOrchestrator({
      boot: createHostBootConfiguration({
        host: AuthoritativeServerHostRuntime,
        mode: "cold-start",
        startupReason: "authoritative-server-bootstrap-orchestrator-missing-config-stage-test",
        requiredDependencyIds: ["dep:application:control-plane-services"],
      }),
      hostOptions: {
        databasePath: "bootstrap-orchestrator-missing-config-stage.sqlite",
      },
      startHost: async () => {
        throw new Error("not-used");
      },
    });

    await expect(missingConfigOrchestrator.execute()).rejects.toThrow(
      "Authoritative server bootstrap orchestrator requires a config stage implementation.",
    );

    const missingSecurityOrchestrator = createAuthoritativeServerBootstrapOrchestrator({
      boot: createHostBootConfiguration({
        host: AuthoritativeServerHostRuntime,
        mode: "cold-start",
        startupReason: "authoritative-server-bootstrap-orchestrator-missing-security-stage-test",
        requiredDependencyIds: ["dep:application:control-plane-services"],
      }),
      hostOptions: {
        databasePath: "bootstrap-orchestrator-missing-security-stage.sqlite",
      },
      startHost: async () => {
        throw new Error("not-used");
      },
      bootstrap: {
        createConfigStage: () => createAuthoritativeServerConfigBootstrapStage(),
      },
    });

    await expect(missingSecurityOrchestrator.execute()).rejects.toThrow(
      "Authoritative server bootstrap orchestrator requires a security stage implementation.",
    );
  });

  it("fails with a meaningful required-input error when route-plan composition is missing", async () => {
    let started = false;
    const lifecycleCalls: string[] = [];

    const orchestrator = createAuthoritativeServerBootstrapOrchestrator({
      boot: createHostBootConfiguration({
        host: AuthoritativeServerHostRuntime,
        mode: "cold-start",
        startupReason: "authoritative-server-bootstrap-orchestrator-missing-route-plan-test",
        requiredDependencyIds: ["dep:application:control-plane-services"],
      }),
      hostOptions: {
        databasePath: "bootstrap-orchestrator-missing-route-plan.sqlite",
      },
      startHost: async () => {
        started = true;
        return {
          port: 6022,
          address: "127.0.0.1:6022",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {
            lifecycleCalls.push("host-close");
          },
        };
      },
      bootstrap: {
        createConfigStage: () => createAuthoritativeServerConfigBootstrapStage(),
        createSecurityStage: () => createAuthoritativeServerSecurityBootstrapStage(),
        composeServiceRegistrationPlan: () => createServicePlan(),
        composeApiRouteRegistrationPlan: () => undefined as unknown as ReturnType<typeof composeAuthoritativeServerApiRouteRegistrationPlan>,
        createPersistenceRuntime: () => Object.freeze({
          configuration: Object.freeze({
            databasePath: "bootstrap-orchestrator-missing-route-plan.sqlite",
            pragmas: Object.freeze({
              journalMode: "WAL",
              foreignKeys: true,
            }),
          }),
          start: async () => {
            lifecycleCalls.push("persistence-start");
          },
          getConnection: () => {
            throw new Error("not-used");
          },
          dispose: async () => {
            lifecycleCalls.push("persistence-runtime-dispose");
          },
        }) satisfies SqlitePersistenceRuntime,
        composePersistentPlatformServices: () => Object.freeze({
          dispose: () => {
            lifecycleCalls.push("persistent-services-dispose");
          },
        }) as AuthoritativePersistentPlatformServices,
        resolveDeploymentPolicyBootstrap: async () => createDeploymentPolicyBootstrapResolutionStub(),
      },
    });

    await expect(orchestrator.execute()).rejects.toThrow(
      "Authoritative server startup requires a composed API route registration plan.",
    );

    expect(started).toBeFalse();
    expect(lifecycleCalls).toEqual([
      "persistence-start",
      "persistent-services-dispose",
      "persistence-runtime-dispose",
    ]);
  });
});
