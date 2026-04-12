import { describe, expect, it } from "bun:test";
import { AuthoritativeServerCompositionModuleIds } from "../composition/contracts/AuthoritativeServerCompositionModuleContracts";
import {
  combineStartupLifecycleHooks,
  createLifecycleCleanupHooksFromShutdownPlan,
} from "../AuthoritativeServerLifecycleComposition";

describe("AuthoritativeServerLifecycleComposition", () => {
  it("composes lifecycle hooks in primary then secondary order", async () => {
    const observed: string[] = [];
    const primary = Object.freeze({
      onStageStarting: async () => {
        observed.push("primary:starting");
      },
      onStageCompleted: async () => {
        observed.push("primary:completed");
      },
      onStageFailed: async () => {
        observed.push("primary:failed");
      },
      onPipelineCompleted: async () => {
        observed.push("primary:pipeline");
      },
    });
    const secondary = Object.freeze({
      onStageStarting: async () => {
        observed.push("secondary:starting");
      },
      onStageCompleted: async () => {
        observed.push("secondary:completed");
      },
      onStageFailed: async () => {
        observed.push("secondary:failed");
      },
      onPipelineCompleted: async () => {
        observed.push("secondary:pipeline");
      },
    });

    const combined = combineStartupLifecycleHooks(primary, secondary);
    await combined.onStageStarting?.({} as never);
    await combined.onStageCompleted?.({} as never);
    await combined.onStageFailed?.({} as never);
    await combined.onPipelineCompleted?.({} as never);

    expect(observed).toEqual([
      "primary:starting",
      "secondary:starting",
      "primary:completed",
      "secondary:completed",
      "primary:failed",
      "secondary:failed",
      "primary:pipeline",
      "secondary:pipeline",
    ]);
  });

  it("maps disposal plan steps into lifecycle cleanup hooks with reason binding", async () => {
    const observed: string[] = [];
    const cleanupHooks = createLifecycleCleanupHooksFromShutdownPlan({
      plan: Object.freeze({
        stageId: "shutdown-preparation",
        steps: Object.freeze([
          Object.freeze({
            hookId: "close-runtime-host",
            moduleId: AuthoritativeServerCompositionModuleIds.transport,
            description: "close runtime host",
            dispose: async (reason: string) => {
              observed.push(`runtime:${reason}`);
            },
          }),
          Object.freeze({
            hookId: "close-persistence-runtime",
            moduleId: AuthoritativeServerCompositionModuleIds.persistenceBootstrap,
            description: "close persistence",
            dispose: async (reason: string) => {
              observed.push(`persistence:${reason}`);
            },
          }),
        ]),
      }),
      reason: "stop-requested",
    });

    expect(cleanupHooks.map((hook) => hook.hookId)).toEqual([
      "close-runtime-host",
      "close-persistence-runtime",
    ]);
    for (const hook of cleanupHooks) {
      await hook.run();
    }

    expect(observed).toEqual([
      "runtime:stop-requested",
      "persistence:stop-requested",
    ]);
  });
});
