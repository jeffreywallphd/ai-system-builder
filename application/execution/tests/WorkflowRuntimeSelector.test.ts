import { describe, expect, it } from "bun:test";
import { WorkflowRuntimeSelector } from "../WorkflowRuntimeSelector";
import type { IWorkflowExecutionStrategy } from "../../ports/interfaces/IWorkflowExecutionStrategy";

const mk = (runtime: string, mode: "delegated" | "interpreted" | "hybrid"): IWorkflowExecutionStrategy => ({
  getDescriptor: () => ({
    id: `${runtime}-${mode}`,
    runtime,
    mode,
    supportsPartialDelegation: mode !== "delegated",
    defaultProvenance: mode === "delegated" ? "delegated" : "scaffolded",
  }),
  canHandle: () => true,
  execute: async () => ({ executionId: "e", status: "completed", outputAssets: [] as const }),
});

describe("WorkflowRuntimeSelector", () => {
  it("prefers explicit runtime/mode matches", async () => {
    const selector = new WorkflowRuntimeSelector();
    const result = await selector.selectStrategy(
      { workflow: { runtimeProfile: { preferredRuntime: "comfyui" } } as never, parameters: { executionMode: "delegated" } },
      [mk("langchain", "interpreted"), mk("comfyui", "delegated")]
    );

    expect(result.strategy.getDescriptor().runtime).toBe("comfyui");
  });

  it("skips delegated execution when the orchestration gate is unavailable and falls back truthfully", async () => {
    const selector = new WorkflowRuntimeSelector({
      runtimeDependencyOrchestrator: {
        ensureAvailable: async () => ({
          requestedDependencyId: "workflow-execution-runtime",
          resolvedDependencyId: "workflow-execution-runtime",
          providerId: "workflow-gate",
          state: "starting",
          health: "degraded",
          availability: "degraded",
          available: false,
          degraded: false,
          checkedAt: new Date().toISOString(),
          dependencyChain: ["python-runtime", "workflow-execution-runtime"],
          fallbackDependencyIds: [],
          usedFallback: false,
          detail: "Delegated workflow execution runtime is still starting.",
          remediationHints: ["Wait for the runtime to finish starting."],
        }),
      },
    });

    const result = await selector.selectStrategy(
      { workflow: { id: "wf-1", runtimeProfile: { preferredRuntime: "python" } } as never },
      [mk("python", "delegated"), mk("langchain", "interpreted")],
    );

    expect(result.strategy.getDescriptor().mode).toBe("interpreted");
    expect(result.reason).toContain("Skipped python-delegated");
    expect(result.reason).toContain("still starting");
  });
});
