import { describe, expect, it } from "bun:test";
import { WorkflowRuntimeSelector } from "../WorkflowRuntimeSelector";

const mk = (runtime: string, mode: "delegated" | "interpreted" | "hybrid") => ({
  getDescriptor: () => ({ id: `${runtime}-${mode}`, runtime, mode, supportsPartialDelegation: mode !== "delegated" }),
  canHandle: () => true,
  execute: async () => ({ executionId: "e", status: "completed", outputAssets: [] as const }),
});

describe("WorkflowRuntimeSelector", () => {
  it("prefers explicit runtime/mode matches", () => {
    const selector = new WorkflowRuntimeSelector();
    const result = selector.selectStrategy(
      { workflow: { runtimeProfile: { preferredRuntime: "comfyui" } } as never, parameters: { executionMode: "delegated" } },
      [mk("langchain", "interpreted"), mk("comfyui", "delegated")]
    );

    expect(result.strategy.getDescriptor().runtime).toBe("comfyui");
  });
});
