import { describe, expect, it } from "bun:test";
import { createHostBootConfiguration } from "@application/common/HostCompositionContracts";
import {
  AuthoritativeServerHostRuntime,
  DesktopHostRuntime,
} from "../../HostRuntimeCatalog";
import {
  HostBootstrapPipelineError,
  HostBootstrapStageIds,
  composeHostBootstrapPipeline,
  createHostDeploymentProfile,
  createHostStartupContext,
  executeHostBootstrapPipeline,
} from "../HostBootstrapPipeline";

describe("HostBootstrapPipeline", () => {
  it("executes canonical startup sequence in explicit deterministic order", async () => {
    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "bootstrap-sequence-test",
    });
    const orderedStages: string[] = [];
    const observedHooks: string[] = [];

    const context = createHostStartupContext({
      boot,
      deploymentProfile: createHostDeploymentProfile({
        profileId: "deployment:test:server",
        environmentName: "test",
        releaseChannel: "ci",
      }),
      environment: {
        NODE_ENV: "test",
      },
      hostConfiguration: {
        runtime: "authoritative-server",
      },
      lifecycleHooks: {
        onStageStarting: (event) => {
          observedHooks.push(`start:${event.stageId}`);
        },
        onStageCompleted: (event) => {
          observedHooks.push(`completed:${event.stageId}`);
        },
      },
    });

    const stages = composeHostBootstrapPipeline({
      reusableStageHandlers: {
        [HostBootstrapStageIds.configuration]: () => {
          orderedStages.push(HostBootstrapStageIds.configuration);
        },
        [HostBootstrapStageIds.dependencies]: () => {
          orderedStages.push(HostBootstrapStageIds.dependencies);
        },
        [HostBootstrapStageIds.logging]: () => {
          orderedStages.push(HostBootstrapStageIds.logging);
        },
        [HostBootstrapStageIds.security]: () => {
          orderedStages.push(HostBootstrapStageIds.security);
        },
        [HostBootstrapStageIds.persistence]: () => {
          orderedStages.push(HostBootstrapStageIds.persistence);
        },
        [HostBootstrapStageIds.featureRegistration]: (stageContext) => {
          orderedStages.push(HostBootstrapStageIds.featureRegistration);
          stageContext.setArtifact("artifact:test:ready", true);
        },
      },
      hostSpecificStages: [{
        stageId: "host:server:startup-customization",
        description: "Authoritative server startup customization stage",
        runAfterStageId: HostBootstrapStageIds.logging,
        run: () => {
          orderedStages.push("host:server:startup-customization");
        },
      }],
    });

    const result = await executeHostBootstrapPipeline({
      context,
      stages,
    });

    expect(orderedStages).toEqual([
      HostBootstrapStageIds.configuration,
      HostBootstrapStageIds.dependencies,
      HostBootstrapStageIds.logging,
      "host:server:startup-customization",
      HostBootstrapStageIds.security,
      HostBootstrapStageIds.persistence,
      HostBootstrapStageIds.featureRegistration,
    ]);
    expect(result.stageHistory.map((entry) => `${entry.status}:${entry.stageId}`)).toEqual([
      "completed:configuration",
      "completed:dependencies",
      "completed:logging",
      "completed:host:server:startup-customization",
      "completed:security",
      "completed:persistence",
      "completed:feature-registration",
    ]);
    expect(observedHooks).toEqual([
      "start:configuration",
      "completed:configuration",
      "start:dependencies",
      "completed:dependencies",
      "start:logging",
      "completed:logging",
      "start:host:server:startup-customization",
      "completed:host:server:startup-customization",
      "start:security",
      "completed:security",
      "start:persistence",
      "completed:persistence",
      "start:feature-registration",
      "completed:feature-registration",
    ]);
    expect(context.getArtifact<boolean>("artifact:test:ready")).toBeTrue();
  });

  it("supports server and desktop hosts through the same shared pipeline", async () => {
    const runs = [
      {
        host: AuthoritativeServerHostRuntime,
        profileId: "deployment:test:server",
      },
      {
        host: DesktopHostRuntime,
        profileId: "deployment:test:desktop",
      },
    ] as const;

    for (const run of runs) {
      const boot = createHostBootConfiguration({
        host: run.host,
        mode: "cold-start",
        startupReason: "multi-host-bootstrap-test",
      });
      const context = createHostStartupContext({
        boot,
        deploymentProfile: createHostDeploymentProfile({
          profileId: run.profileId,
          environmentName: "test",
          releaseChannel: "ci",
        }),
        environment: {
          NODE_ENV: "test",
        },
        hostConfiguration: {
          hostId: run.host.hostId,
        },
      });

      const stages = composeHostBootstrapPipeline({
        reusableStageHandlers: {
          [HostBootstrapStageIds.featureRegistration]: (stageContext) => {
            stageContext.setArtifact("artifact:test:host-id", stageContext.boot.host.hostId);
          },
        },
      });

      const result = await executeHostBootstrapPipeline({
        context,
        stages,
      });

      expect(result.executedStageIds).toEqual([
        HostBootstrapStageIds.configuration,
        HostBootstrapStageIds.dependencies,
        HostBootstrapStageIds.logging,
        HostBootstrapStageIds.security,
        HostBootstrapStageIds.persistence,
        HostBootstrapStageIds.featureRegistration,
      ]);
      expect(context.getArtifact<string>("artifact:test:host-id")).toBe(run.host.hostId);
    }
  });

  it("fails composition when host-specific stages duplicate canonical stage ids", () => {
    expect(() => composeHostBootstrapPipeline({
      hostSpecificStages: [{
        stageId: HostBootstrapStageIds.configuration,
        description: "invalid duplication",
        run: () => {},
      }],
    })).toThrow(HostBootstrapPipelineError);
  });

  it("captures failed stage history when a stage throws", async () => {
    const boot = createHostBootConfiguration({
      host: AuthoritativeServerHostRuntime,
      mode: "cold-start",
      startupReason: "bootstrap-failure-test",
    });
    const context = createHostStartupContext({
      boot,
      deploymentProfile: createHostDeploymentProfile({
        profileId: "deployment:test:failure",
        environmentName: "test",
        releaseChannel: "ci",
      }),
      environment: {
        NODE_ENV: "test",
      },
      hostConfiguration: {
        runtime: "failure",
      },
    });

    const stages = composeHostBootstrapPipeline({
      reusableStageHandlers: {
        [HostBootstrapStageIds.security]: () => {
          throw new Error("security prerequisites failed");
        },
      },
    });

    await expect(executeHostBootstrapPipeline({
      context,
      stages,
    })).rejects.toThrow(HostBootstrapPipelineError);
  });
});

