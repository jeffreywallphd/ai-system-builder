import { describe, expect, it } from "bun:test";
import { makeNode } from "../../../../domain/workflows/tests/testUtils";
import { Node } from "../../../../domain/nodes/Node";
import { NodeDefinition } from "../../../../domain/nodes/NodeDefinition";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { LangChainNodeExecutor } from "../LangChainNodeExecutor";

function makeLangChainNode(id: string, type: string, properties: ReadonlyArray<NodeProperty> = []): Node {
  return new Node({
    id,
    definition: new NodeDefinition({
      id: `def-${id}`,
      type,
      title: type,
      category: "utility",
      executionKind: "generic",
      properties,
      inputPorts: [],
      outputPorts: [],
    }),
  });
}

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

  it("executes context merger nodes with deterministic merged output", async () => {
    const node = makeLangChainNode("n-context", "langchain.context-merger", [
      new NodeProperty({ id: "separator", name: "Separator", type: "text", value: " | " }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { context_blocks: ["one", "two"] },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toEqual({ merged_context: "one | two", block_count: 2 });
  });

  it("executes output parser nodes and trims known prefixes", async () => {
    const node = makeLangChainNode("n-parse", "langchain.output-parser", [
      new NodeProperty({ id: "prefix", name: "Prefix", type: "text", value: "Answer:" }),
    ]);
    const executor = new LangChainNodeExecutor();
    const result = await executor.executeNode({
      workflow: {} as never,
      node,
      inputAssets: [],
      workflowInputs: {},
      upstreamOutputs: {},
      resolvedInputs: { output_text: "Answer: structured value" },
    });

    expect(result.status).toBe("completed");
    expect(result.outputs).toEqual({
      parsed_output: "structured value",
      raw_output: "Answer: structured value",
    });
  });
});
