import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import { AuthoritativeServerHostRuntime } from "../../HostRuntimeCatalog";
import { HostBootstrapStageIds } from "@hosts/bootstrap/HostBootstrapPipeline";
import { createAuthoritativeServerCompositionRoot } from "../AuthoritativeServerCompositionRoot";
import {
  AuthoritativeServerRequiredRouteFamilyIds,
  composeAuthoritativeServerApiRouteRegistrationPlan,
} from "../AuthoritativeServerApiRouteComposition";
import type { AuthoritativeApiRouteRegistrationPlan } from "@infrastructure/transport/http-server/AuthoritativeApiRouteRegistration";

class CapturingHostLogger {
  public readonly infoEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly warnEvents: Array<Readonly<Record<string, unknown>>> = [];
  public readonly errorEvents: Array<Readonly<Record<string, unknown>>> = [];

  public info(event: Readonly<Record<string, unknown>>): void {
    this.infoEvents.push(event);
  }

  public warn(event: Readonly<Record<string, unknown>>): void {
    this.warnEvents.push(event);
  }

  public error(event: Readonly<Record<string, unknown>>): void {
    this.errorEvents.push(event);
  }
}

describe("AuthoritativeServer startup harness", () => {
  it("simulates startup and enforces shared pipeline plus authoritative stage order", async () => {
    const logger = new CapturingHostLogger();
    const observedPipelineStarts: string[] = [];
    const observedPipelineCompletions: string[] = [];
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "startup-harness.sqlite",
        logger,
      },
      startHost: async () => ({
        port: 6001,
        address: "127.0.0.1:6001",
        secretService: {} as never,
        platformSecretConsumers: {} as never,
        close: async () => {},
      }),
      bootstrap: {
        lifecycleHooks: {
          onStageStarting: async (event) => {
            observedPipelineStarts.push(event.stageId);
          },
          onStageCompleted: async (event) => {
            observedPipelineCompletions.push(event.stageId);
          },
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-startup-harness-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
      environment: {
        NODE_ENV: "test",
      },
    });

    const runtime = await root.compose(boot);
    await runtime.stop();

    const expectedPipelineOrder = [
      HostBootstrapStageIds.configuration,
      HostBootstrapStageIds.dependencies,
      HostBootstrapStageIds.logging,
      HostBootstrapStageIds.security,
      HostBootstrapStageIds.persistence,
      HostBootstrapStageIds.featureRegistration,
    ];
    expect(observedPipelineStarts).toEqual(expectedPipelineOrder);
    expect(observedPipelineCompletions).toEqual(expectedPipelineOrder);

    const startupSummary = logger.infoEvents.find((event) => event.event === "authoritative-server.startup.summary");
    expect(startupSummary).toBeDefined();
    const pipelineStages = (
      startupSummary?.pipeline as
      | {
        readonly stages?: ReadonlyArray<{
          readonly stageId: string;
          readonly status: string;
        }>;
      }
      | undefined
    )?.stages;
    expect(pipelineStages?.map((stage) => stage.stageId)).toEqual(expectedPipelineOrder);
    expect(pipelineStages?.every((stage) => stage.status === "completed")).toBeTrue();

    const authoritativeStages = (
      startupSummary?.authoritativeStages as
      | {
        readonly stages?: ReadonlyArray<{
          readonly stageId: string;
          readonly state: string;
        }>;
      }
      | undefined
    )?.stages;
    expect(authoritativeStages?.map((stage) => stage.stageId)).toEqual([
      "services",
      "security",
      "persistence",
      "transport",
    ]);
    expect(authoritativeStages?.every((stage) => stage.state === "success")).toBeTrue();
  });

  it("passes deterministic modular route registration into runtime startup composition", async () => {
    let observedRouteFamilyIds: ReadonlyArray<string> = [];
    let observedRoutePrefixes: ReadonlyArray<string> = [];
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "startup-harness-route-plan.sqlite",
      },
      startHost: async (options) => {
        const routePlan = options.routeRegistrationPlan;
        observedRouteFamilyIds = routePlan?.registeredRouteFamilies.map((family) => family.routeFamilyId) ?? [];
        observedRoutePrefixes = routePlan?.registeredRoutePrefixes ?? [];
        return {
          port: 6002,
          address: "127.0.0.1:6002",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        composeApiRouteRegistrationPlan: () => composeAuthoritativeServerApiRouteRegistrationPlan(),
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-startup-harness-route-plan-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    const runtime = await root.compose(boot);
    await runtime.stop();

    expect(observedRouteFamilyIds).toEqual(AuthoritativeServerRequiredRouteFamilyIds);
    expect(observedRoutePrefixes).toContain("/api/v1/identity");
    expect(observedRoutePrefixes).toContain("/api/v1/workspaces");
    expect(observedRoutePrefixes).toContain("/api/v1/runtime/runs/start");
  });

  it("fails startup before runtime host start when registration invariants reject duplicate families", async () => {
    let started = false;
    const validPlan = composeAuthoritativeServerApiRouteRegistrationPlan();
    const invalidPlan: AuthoritativeApiRouteRegistrationPlan = Object.freeze({
      ...validPlan,
      registeredRouteFamilies: Object.freeze([
        validPlan.registeredRouteFamilies[0]!,
        validPlan.registeredRouteFamilies[0]!,
        ...validPlan.registeredRouteFamilies.slice(1),
      ]),
    });
    const root = createAuthoritativeServerCompositionRoot({
      hostOptions: {
        databasePath: "startup-harness-invalid-route-plan.sqlite",
      },
      startHost: async () => {
        started = true;
        return {
          port: 6003,
          address: "127.0.0.1:6003",
          secretService: {} as never,
          platformSecretConsumers: {} as never,
          close: async () => {},
        };
      },
      bootstrap: {
        composeApiRouteRegistrationPlan: () => invalidPlan,
        assertApiRouteRegistrationCoverage: (plan) => {
          const routeFamilyIds = plan.registeredRouteFamilies.map((family) => family.routeFamilyId);
          if (new Set(routeFamilyIds).size !== routeFamilyIds.length) {
            throw new Error("duplicate route family");
          }
        },
      },
    });

    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "authoritative-server-startup-harness-invalid-route-plan-test",
      requiredDependencyIds: ["dep:application:control-plane-services"],
    });

    await expect(root.compose(boot)).rejects.toThrow("duplicate route family");
    expect(started).toBeFalse();
  });
});
