import { describe, expect, it } from "bun:test";
import {
  HostCapabilityFlags,
  HostControlPlaneRoles,
  HostRuntimeKinds,
  createHostRuntimeIdentity,
} from "@domain/hosts/HostRuntimeDomain";
import {
  HostCompositionContractError,
  createHostBootConfiguration,
} from "@application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { createAuthoritativeServerCompositionRoot } from "../AuthoritativeServerCompositionRoot";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import type { HostServiceRegistrationPlan } from "@infrastructure/config/HostServiceRegistration";
import { HostServiceRegistrationError } from "@infrastructure/config/HostServiceRegistration";
import {
  AuthoritativeServerComfyUiExecutionAdapterArtifactKey,
  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
  AuthoritativeServerPersistentPlatformServicesArtifactKey,
  AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey,
  AuthoritativeServerServiceRegistrationPlanArtifactKey,
} from "../AuthoritativeServerCompositionRoot";
import { AuthoritativeServerApiRouteRegistrationPlanArtifactKey } from "../AuthoritativeServerApiRouteComposition";
import {
  HostDeploymentProfileIds,
  HostStartupEnvironmentKeys,
} from "@infrastructure/config/HostStartupConfiguration";
import type { SqlitePersistenceRuntime } from "@infrastructure/persistence/sqlite/SqlitePersistenceRuntime";
import type { AuthoritativePersistentPlatformServices } from "@infrastructure/persistence/AuthoritativePersistenceComposition";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";
import type { DeploymentPolicyBootstrapResolutionResult } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";

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

describe("AuthoritativeServerCompositionRoot", () => {
  it("composes and stops authoritative server runtime with lifecycle transitions", async () => {
    let closed = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 4100,
        address: "127.0.0.1:4100",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          closed = true;
        },
      }),
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(runtime.port).toBe(4100);
    expect(runtime.phase).toBe("ready");
    expect(runtime.runtimeMetadata.hostId).toBe("host:server:authoritative");
    expect(runtime.runtimeMetadata.roleInspection.isAuthoritativeControlPlane).toBeTrue();
    expect(runtime.runtimeMetadata.advertisedCapabilities.some((capability) => capability.capability === HostCapabilityFlags.controlPlaneAuthority)).toBeTrue();
    expect(runtime.readiness?.marker).toBe("authoritative-server:feature-registration-complete");
    expect(runtime.lifecycleEvents?.some((event) => event.type === "startup-completed")).toBeTrue();
    expect(runtime.transitionHistory.map((entry) => entry.to)).toEqual([
      "composing",
      "starting",
      "ready",
    ]);

    await runtime.stop();
    expect(closed).toBeTrue();
    expect(runtime.phase).toBe("stopped");
    expect(runtime.lifecycleEvents?.some((event) => event.type === "shutdown-completed")).toBeTrue();
  });

  it("rejects non-authoritative hosts for authoritative composition root", async () => {
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        throw new Error("should not start");
      },
    });

    const nonAuthoritativeHost = createHostRuntimeIdentity({
      hostId: "host:worker:runtime",
      kind: HostRuntimeKinds.worker,
      controlPlaneRole: HostControlPlaneRoles.none,
      capabilities: [
        HostCapabilityFlags.workerRuntime,
        HostCapabilityFlags.nodeExecution,
      ],
      responsibilities: [
        "execute workloads",
      ],
      startupDependencies: AuthoritativeServerHostRuntime.startupDependencies,
    });
    const boot = createHostBootConfiguration({
      host: nonAuthoritativeHost,
      mode: "cold-start",
      startupReason: "invalid-authority-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostCompositionContractError);
  });

  it("supports host-specific bootstrap customization stages without replacing shared pipeline", async () => {
    const observedStages: string[] = [];
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5200,
        address: "127.0.0.1:5200",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: () => {
            observedStages.push(HostBootstrapStageIds.configuration);
          },
          [HostBootstrapStageIds.dependencies]: () => {
            observedStages.push(HostBootstrapStageIds.dependencies);
          },
          [HostBootstrapStageIds.logging]: () => {
            observedStages.push(HostBootstrapStageIds.logging);
          },
          [HostBootstrapStageIds.security]: () => {
            observedStages.push(HostBootstrapStageIds.security);
          },
          [HostBootstrapStageIds.persistence]: () => {
            observedStages.push(HostBootstrapStageIds.persistence);
          },
        },
        hostSpecificStages: [{
          stageId: "host:server:post-security-bootstrap",
          description: "Host-specific stage after security baseline",
          runAfterStageId: HostBootstrapStageIds.security,
          run: () => {
            observedStages.push("host:server:post-security-bootstrap");
          },
        }],
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-customization-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedStages).toEqual([
      "configuration",
      "dependencies",
      "logging",
      "security",
      "host:server:post-security-bootstrap",
      "persistence",
    ]);
    expect(runtime.phase).toBe("ready");
    await runtime.stop();
    expect(runtime.phase).toBe("stopped");
  });

  it("runs default dependencies composition before custom dependency-stage handlers", async () => {
    let observedPlanHostId: string | undefined;
    let observedRouteFamilyIds: ReadonlyArray<string> | undefined;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5300,
        address: "127.0.0.1:5300",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const plan = context.getArtifact<HostServiceRegistrationPlan>(
              AuthoritativeServerServiceRegistrationPlanArtifactKey,
            );
            observedPlanHostId = plan?.hostId;
            const routePlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
              AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
            );
            observedRouteFamilyIds = routePlan?.registeredRouteFamilies.map((family) => family.routeFamilyId);
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-dependency-stage-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(observedPlanHostId).toBe(AuthoritativeServerHostRuntime.hostId);
    expect(observedRouteFamilyIds).toContain("identity-auth");
    expect(observedRouteFamilyIds).toContain("workspace-administration");
    expect(observedRouteFamilyIds).toContain("deployment-policy-read");
    expect(observedRouteFamilyIds).toContain("deployment-policy-write");
    expect(observedRouteFamilyIds).toContain("audit-ledger");
    expect(observedRouteFamilyIds).toContain("node-trust");
    expect(observedRouteFamilyIds).toContain("execution-node-management");
    expect(observedRouteFamilyIds).toContain("run-submission");
    expect(observedRouteFamilyIds).toContain("run-read");
    expect(observedRouteFamilyIds).toContain("run-mutation");
    expect(observedRouteFamilyIds).toContain("image-run-api");
    expect(observedRouteFamilyIds).toContain("run-execution-update");
    await runtime.stop();
  });

  it("composes ComfyUI execution adapter infrastructure through dependencies stage when enabled by environment", async () => {
    let observedComfyBaseUrl: string | undefined;
    let observedComfyEnabled: boolean | undefined;
    let observedComfyHasAuthToken: boolean | undefined;
    let observedRegisteredBackends: ReadonlyArray<string> | undefined;
    let observedHasCancellationSignalPort = false;
    let observedHasCapabilityProbePort = false;

    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5310,
        address: "127.0.0.1:5310",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const composed = context.getArtifact<{
              readonly config: {
                readonly enabled: boolean;
                readonly baseUrl?: string;
                toSafeSnapshot(): Readonly<Record<string, unknown>>;
              };
            }>(AuthoritativeServerComfyUiExecutionAdapterArtifactKey);
            const snapshot = composed?.config.toSafeSnapshot();
            observedComfyEnabled = composed?.config.enabled;
            observedComfyBaseUrl = composed?.config.baseUrl;
            observedComfyHasAuthToken = snapshot?.hasAuthToken === true;
            const registration = context.getArtifact<{
              readonly registeredBackendKinds: ReadonlyArray<string>;
              readonly cancellationSignalPort?: unknown;
              readonly capabilityProbePort?: unknown;
            }>(AuthoritativeServerRunExecutionAdapterRegistrationArtifactKey);
            observedRegisteredBackends = registration?.registeredBackendKinds;
            observedHasCancellationSignalPort = !!registration?.cancellationSignalPort;
            observedHasCapabilityProbePort = !!registration?.capabilityProbePort;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-comfyui-composition-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        AI_LOOM_COMFYUI_ADAPTER_ENABLED: "true",
        AI_LOOM_COMFYUI_BASE_URL: "http://127.0.0.1:8188/",
        AI_LOOM_COMFYUI_AUTH_TOKEN: "super-secret",
      },
    });

    const runtime = await root.compose(boot);
    expect(observedComfyEnabled).toBeTrue();
    expect(observedComfyBaseUrl).toBe("http://127.0.0.1:8188");
    expect(observedComfyHasAuthToken).toBeTrue();
    expect(observedRegisteredBackends).toEqual(["comfyui"]);
    expect(observedHasCancellationSignalPort).toBeTrue();
    expect(observedHasCapabilityProbePort).toBeTrue();
    await runtime.stop();
  });

  it("passes composed run-execution adapter registration into runtime host startup options", async () => {
    let observedRunExecutionRegistration: {
      readonly registeredBackendKinds: ReadonlyArray<string>;
      readonly cancellationSignalPort?: unknown;
      readonly capabilityProbePort?: unknown;
    } | undefined;

    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async (options) => {
        observedRunExecutionRegistration = options.runExecutionAdapters;
        return {
          port: 5311,
          address: "127.0.0.1:5311",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-run-execution-registration-pass-through-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        AI_LOOM_COMFYUI_ADAPTER_ENABLED: "true",
        AI_LOOM_COMFYUI_BASE_URL: "http://127.0.0.1:8188/",
      },
    });

    const runtime = await root.compose(boot);
    expect(observedRunExecutionRegistration?.registeredBackendKinds).toEqual(["comfyui"]);
    expect(observedRunExecutionRegistration?.cancellationSignalPort).toBeDefined();
    expect(observedRunExecutionRegistration?.capabilityProbePort).toBeDefined();
    await runtime.stop();
  });

  it("surfaces ComfyUI adapter configuration failures during startup dependencies composition", async () => {
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5312,
        address: "127.0.0.1:5312",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-comfyui-config-failure-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        AI_LOOM_COMFYUI_ADAPTER_ENABLED: "true",
      },
    });

    await expect(root.compose(boot)).rejects.toThrow(
      "ComfyUI execution adapter infrastructure requires a configured baseUrl.",
    );
  });

  it("fails compose when authoritative service coverage assertions fail", async () => {
    let started = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        started = true;
        return {
          port: 5400,
          address: "127.0.0.1:5400",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        composeServiceRegistrationPlan: () => Object.freeze({
          hostId: AuthoritativeServerHostRuntime.hostId,
          selectedServices: Object.freeze([]),
          startupDependencyCoverage: Object.freeze({}),
          servicesByLayer: Object.freeze({
            "shared-contracts": Object.freeze([]),
            domain: Object.freeze([]),
            application: Object.freeze([]),
            infrastructure: Object.freeze([]),
            host: Object.freeze([]),
          }),
        }),
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-missing-service-coverage-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow(HostServiceRegistrationError);
    expect(started).toBeFalse();
  });

  it("fails compose when authoritative API route coverage assertions fail", async () => {
    let started = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        started = true;
        return {
          port: 5410,
          address: "127.0.0.1:5410",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        assertApiRouteRegistrationCoverage: () => {
          throw new Error("missing required API route families");
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-missing-route-coverage-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow("missing required API route families");
    expect(started).toBeFalse();
  });

  it("fails compose explicitly when deployment policy bootstrap resolution fails", async () => {
    let started = false;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => {
        started = true;
        return {
          port: 5450,
          address: "127.0.0.1:5450",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        createPersistenceRuntime: () => Object.freeze({
          configuration: Object.freeze({
            databasePath: "test.sqlite",
            pragmas: Object.freeze({
              journalMode: "WAL",
              foreignKeys: true,
            }),
          }),
          start: async () => Object.freeze({
            databasePath: "test.sqlite",
            migrationIdsApplied: Object.freeze([]),
          }),
          getConnection: () => {
            throw new Error("not used");
          },
          dispose: async () => {},
        }) satisfies SqlitePersistenceRuntime,
        composePersistentPlatformServices: () => Object.freeze({
          databasePath: "test.sqlite",
          identityRepository: {} as never,
          trustedDeviceRepository: {} as never,
          workspaceRepository: {} as never,
          authorizationRepository: {} as never,
          nodeTrustRepository: {} as never,
          executionNodeRepository: {} as never,
          nodeTrustAuditRecorder: {} as never,
          certificateAuthorityRepository: {} as never,
          secretRecordRepository: {} as never,
          storageInstanceRepository: {} as never,
          storageManagementAuditRecorder: {} as never,
          assetRepository: {} as never,
          assetAuditRecorder: {} as never,
          assetUploadSessionRepository: {} as never,
          imageAssetRepository: {} as never,
          imageWorkflowSystemRepository: {} as never,
          platformPersistenceRepository: {} as never,
          auditLedgerRepository: {} as never,
          deploymentPolicyRepository: {} as never,
          generatedResultRepository: {} as never,
          dispose: () => {},
        }) satisfies AuthoritativePersistentPlatformServices,
        resolveDeploymentPolicyBootstrap: async () => {
          throw new Error("invalid-persisted-state");
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-deployment-policy-bootstrap-failure-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow("invalid-persisted-state");
    expect(started).toBeFalse();
  });

  it("resolves deployment profile and enabled capabilities through shared startup configuration", async () => {
    let observedProfileId: string | undefined;
    let observedEnvironmentName: string | undefined;
    let observedCapabilities: ReadonlyArray<string> | undefined;
    let observedRuntimeProfileId: string | undefined;
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async (options) => {
        observedRuntimeProfileId = options.deploymentProfile?.profileId;
        return {
          port: 5500,
          address: "127.0.0.1:5500",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.configuration]: (context) => {
            observedProfileId = context.deploymentProfile.profileId;
            observedEnvironmentName = context.deploymentProfile.environmentName;
            observedCapabilities = context.enabledCapabilities;
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-startup-config-resolution-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        [HostStartupEnvironmentKeys.deploymentProfile]: HostDeploymentProfileIds.organization,
        [HostStartupEnvironmentKeys.environmentName]: "production",
      },
    });

    const runtime = await root.compose(boot);
    expect(observedProfileId).toBe(HostDeploymentProfileIds.organization);
    expect(observedEnvironmentName).toBe("production");
    expect(observedCapabilities).toContain(HostCapabilityFlags.controlPlaneAuthority);
    expect(observedRuntimeProfileId).toBe(HostDeploymentProfileIds.organization);
    await runtime.stop();
  });

  it("initializes and disposes persistence runtime through bootstrap and lifecycle cleanup", async () => {
    const calls: string[] = [];
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async () => ({
        port: 5600,
        address: "127.0.0.1:5600",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          calls.push("host-close");
        },
      }),
      bootstrap: {
        createPersistenceRuntime: ({ hostConfiguration, environment }) => {
          expect(hostConfiguration.databasePath).toBe("test.sqlite");
          expect(environment.NODE_ENV).toBe("test");
          return Object.freeze({
            configuration: Object.freeze({
              databasePath: hostConfiguration.databasePath,
              pragmas: Object.freeze({
                journalMode: "WAL",
                foreignKeys: true,
              }),
            }),
            start: async () => {
              calls.push("persistence-start");
              return Object.freeze({
                databasePath: hostConfiguration.databasePath,
                migrationIdsApplied: Object.freeze([]),
              });
            },
            getConnection: () => {
              throw new Error("not needed for composition test");
            },
            dispose: async () => {
              calls.push("persistence-dispose");
            },
          }) satisfies SqlitePersistenceRuntime;
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-persistence-lifecycle-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        NODE_ENV: "test",
      },
    });

    const runtime = await root.compose(boot);
    expect(runtime.phase).toBe("ready");
    expect(calls).toEqual(["persistence-start"]);

    await runtime.stop();
    expect(calls).toEqual([
      "persistence-start",
      "host-close",
      "persistence-dispose",
    ]);
  });

  it("composes persistent platform services during persistence stage and injects them into runtime host startup", async () => {
    const calls: string[] = [];
    let startedWithServices: AuthoritativePersistentPlatformServices | undefined;
    let startedWithDeploymentPolicyBootstrap: DeploymentPolicyBootstrapResolutionResult | undefined;
    const persistentServices = Object.freeze({
      databasePath: "test.sqlite",
      identityRepository: {} as never,
      trustedDeviceRepository: {} as never,
      workspaceRepository: {} as never,
      authorizationRepository: {} as never,
      nodeTrustRepository: {} as never,
      executionNodeRepository: {} as never,
      nodeTrustAuditRecorder: {} as never,
      certificateAuthorityRepository: {} as never,
      secretRecordRepository: {} as never,
      storageInstanceRepository: {} as never,
      storageManagementAuditRecorder: {} as never,
      assetRepository: {} as never,
      assetAuditRecorder: {} as never,
      assetUploadSessionRepository: {} as never,
      imageAssetRepository: {} as never,
      imageWorkflowSystemRepository: {} as never,
      platformPersistenceRepository: {} as never,
      auditLedgerRepository: {} as never,
      deploymentPolicyRepository: {} as never,
      generatedResultRepository: {} as never,
      dispose: () => {
        calls.push("persistent-services-dispose");
      },
    }) satisfies AuthoritativePersistentPlatformServices;

    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "test.sqlite",
      },
      startHost: async (options) => {
        startedWithServices = options.persistentPlatformServices;
        startedWithDeploymentPolicyBootstrap = options.deploymentPolicyBootstrap;
        return {
          port: 5700,
          address: "127.0.0.1:5700",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {
            calls.push("host-close");
          },
        };
      },
        bootstrap: {
        createPersistenceRuntime: () => Object.freeze({
          configuration: Object.freeze({
            databasePath: "test.sqlite",
            pragmas: Object.freeze({
              journalMode: "WAL",
              foreignKeys: true,
            }),
          }),
          start: async () => {
            calls.push("persistence-start");
            return Object.freeze({
              databasePath: "test.sqlite",
              migrationIdsApplied: Object.freeze([]),
            });
          },
          getConnection: () => {
            throw new Error("not used");
          },
          dispose: async () => {
            calls.push("persistence-runtime-dispose");
          },
          }) satisfies SqlitePersistenceRuntime,
          composePersistentPlatformServices: () => persistentServices,
          resolveDeploymentPolicyBootstrap: async () => createDeploymentPolicyBootstrapResolutionStub(),
          stageHandlers: {
            [HostBootstrapStageIds.persistence]: (context) => {
              const artifact = context.getArtifact<AuthoritativePersistentPlatformServices>(
                AuthoritativeServerPersistentPlatformServicesArtifactKey,
              );
              expect(artifact).toBe(persistentServices);
              const deploymentPolicyBootstrapArtifact =
                context.getArtifact<DeploymentPolicyBootstrapResolutionResult>(
                  AuthoritativeServerDeploymentPolicyBootstrapArtifactKey,
                );
              expect(deploymentPolicyBootstrapArtifact?.activeProfile.profileId).toBe(HostDeploymentProfileIds.home);
            },
          },
        },
      });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-persistent-services-integration-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    expect(startedWithServices).toBe(persistentServices);
    expect(startedWithDeploymentPolicyBootstrap?.activeProfile.profileId).toBe(HostDeploymentProfileIds.home);
    expect(calls).toEqual(["persistence-start"]);

    await runtime.stop();
    expect(calls).toEqual([
      "persistence-start",
      "host-close",
      "persistent-services-dispose",
      "persistence-runtime-dispose",
    ]);
  });
});


