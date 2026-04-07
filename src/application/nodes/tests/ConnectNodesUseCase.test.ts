import { describe, expect, it } from "bun:test";
import { ConnectNodesUseCase } from "../ConnectNodesUseCase";
import { makeConnection, makeNode, makeNodePort, makeWorkflow } from "@domain/services/tests/testUtils";
import { makeNodeCompatibilityService } from "./testUtils";

describe("ConnectNodesUseCase", () => {
  it("connects compatible ports", () => {
    const source = makeNode({ id: "src", outputPorts: [makeNodePort({ id: "out", direction: "output" })] });
    const target = makeNode({ id: "dst", inputPorts: [makeNodePort({ id: "in", direction: "input" })] });
    const workflow = makeWorkflow({ nodes: [source, target] });

    const result = new ConnectNodesUseCase(makeNodeCompatibilityService(), () => "cx").execute({
      workflow,
      sourceNodeId: "src",
      sourcePortId: "out",
      targetNodeId: "dst",
      targetPortId: "in",
    });

    expect(result.connection.id).toBe("cx");
    expect(result.workflow.connections).toHaveLength(1);
  });

  it("rejects duplicate connection", () => {
    const source = makeNode({ id: "src", outputPorts: [makeNodePort({ id: "out", direction: "output" })] });
    const target = makeNode({ id: "dst", inputPorts: [makeNodePort({ id: "in", direction: "input" })] });
    const workflow = makeWorkflow({ nodes: [source, target], connections: [makeConnection("c", "src", "dst")] });

    expect(() => new ConnectNodesUseCase(makeNodeCompatibilityService()).execute({ workflow, sourceNodeId: "src", sourcePortId: "out", targetNodeId: "dst", targetPortId: "in" })).toThrow("already exists");
  });
});

