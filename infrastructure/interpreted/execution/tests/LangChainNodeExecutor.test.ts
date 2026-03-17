import { describe, expect, it } from "bun:test";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

describe("LangChainNodeExecutor", () => {
  it("returns scaffold outputs for generic nodes", async () => {
    const node = makeNode({ id: "n1" });
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { in: "value" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toHaveProperty("result");
  });
});
