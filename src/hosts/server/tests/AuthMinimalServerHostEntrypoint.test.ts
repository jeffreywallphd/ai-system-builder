import { describe, expect, it } from "bun:test";
import { HostBootstrapStageIds } from "../../bootstrap/HostBootstrapPipeline";
import {
  constructAuthMinimalServerHostAssembly,
  createAuthMinimalServerHostBootConfiguration,
  startAuthMinimalServerHostAssembly,
} from "../AuthMinimalServerHostEntrypoint";
import { AuthoritativeServerApiRouteRegistrationPlanArtifactKey } from "../AuthoritativeServerApiRouteComposition";
import { AuthoritativeServerPersistentPlatformServicesArtifactKey } from "../AuthoritativeServerCompositionRoot";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";

describe("AuthMinimalServerHostEntrypoint", () => {
  it("constructs a boot configuration with auth-minimal startup reason", () => {
    const boot = createAuthMinimalServerHostBootConfiguration({
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(boot.host.hostId).toBe("host:server:authoritative");
    expect(boot.startupReason).toBe("auth-minimal-server-entrypoint-startup");
  });

  it("composes auth-minimal route registration and starts through the dedicated entrypoint", async () => {
    let observedRouteFamilyIds: ReadonlyArray<string> = [];
    let composedAuthMinimalPersistenceShape: Readonly<Record<string, unknown>> | undefined;
    let stopCount = 0;

    const assembly = constructAuthMinimalServerHostAssembly({
      hostOptions: {
        databasePath: "auth-minimal.sqlite",
      },
      startHost: async () => ({
        port: 6300,
        address: "127.0.0.1:6300",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          stopCount += 1;
        },
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const routePlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
              AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
            );
            observedRouteFamilyIds = routePlan?.registeredRouteFamilies.map((family) => family.routeFamilyId) ?? [];
          },
          [HostBootstrapStageIds.persistence]: (context) => {
            const services = context.getArtifact<unknown>(
              AuthoritativeServerPersistentPlatformServicesArtifactKey,
            );
            composedAuthMinimalPersistenceShape = (services ?? {}) as Readonly<Record<string, unknown>>;
          },
        },
      },
    });

    expect(assembly.boot.startupReason).toBe("auth-minimal-server-entrypoint-startup");

    const runtime = await startAuthMinimalServerHostAssembly({
      hostOptions: {
        databasePath: "auth-minimal.sqlite",
      },
      startHost: async () => ({
        port: 6300,
        address: "127.0.0.1:6300",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {
          stopCount += 1;
        },
      }),
      bootstrap: {
        stageHandlers: {
          [HostBootstrapStageIds.dependencies]: (context) => {
            const routePlan = context.getArtifact<AuthoritativeApiRouteRegistrationPlan>(
              AuthoritativeServerApiRouteRegistrationPlanArtifactKey,
            );
            observedRouteFamilyIds = routePlan?.registeredRouteFamilies.map((family) => family.routeFamilyId) ?? [];
          },
          [HostBootstrapStageIds.persistence]: (context) => {
            const services = context.getArtifact<unknown>(
              AuthoritativeServerPersistentPlatformServicesArtifactKey,
            );
            composedAuthMinimalPersistenceShape = (services ?? {}) as Readonly<Record<string, unknown>>;
          },
        },
      },
    });

    expect(runtime.phase).toBe("ready");
    expect(observedRouteFamilyIds).toEqual(["identity-auth"]);
    expect(composedAuthMinimalPersistenceShape?.identityRepository).toBeDefined();
    expect(composedAuthMinimalPersistenceShape?.trustedDeviceRepository).toBeDefined();
    expect(composedAuthMinimalPersistenceShape?.workspaceRepository).toBeDefined();
    expect(composedAuthMinimalPersistenceShape?.authorizationRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.deploymentPolicyRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.storageInstanceRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.assetRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.platformPersistenceRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.auditLedgerRepository).toBeUndefined();
    expect(composedAuthMinimalPersistenceShape?.generatedResultRepository).toBeUndefined();

    await runtime.stop();
    expect(runtime.phase).toBe("stopped");
    expect(stopCount).toBe(1);
  });
});
