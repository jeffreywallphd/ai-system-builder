import { describe, expect, it } from "bun:test";
import { WorkflowExecutionContextResolver } from "../WorkflowExecutionContextResolver";

describe("WorkflowExecutionContextResolver", () => {
  it("delegates to node-level resolver", () => {
    const service = new WorkflowExecutionContextResolver({
      resolve: (input) => ({
        workflow: input.workflow,
        node: input.node,
        inputAssets: [],
        workflowInputs: {},
        upstreamOutputs: {},
        resolvedInputs: { ok: true },
      }),
    });

    const context = service.resolveNodeContext({ workflow: {} as never, node: {} as never, outputStore: {} as never });
    expect(context.resolvedInputs).toEqual({ ok: true });
  });
});
