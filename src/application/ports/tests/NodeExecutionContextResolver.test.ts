import { describe, expect, it } from "bun:test";
import type { INodeExecutionContextResolver } from "../interfaces/INodeExecutionContextResolver";

describe("INodeExecutionContextResolver contract", () => {
  it("resolves a node execution context", () => {
    const resolver: INodeExecutionContextResolver = {
      resolve: (input) => ({
        workflow: input.workflow,
        node: input.node,
        inputAssets: [],
        workflowInputs: {},
        upstreamOutputs: {},
        resolvedInputs: {},
      }),
    };

    const context = resolver.resolve({ workflow: {} as never, node: {} as never, outputStore: {} as never });
    expect(context).toHaveProperty("resolvedInputs");
  });
});
