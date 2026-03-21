import { describe, expect, it } from "bun:test";
import { Node } from "../../../domain/nodes/Node";
import { classifyNodeTruth, ensureNodeExecutionProvenance, aggregateWorkflowProvenance, deriveMcpExecutionProvenance } from "../ExecutionTruth";

function makeNode(nodeType: string) {
  return new Node({
    id: `node-${nodeType}`,
    definition: { id: nodeType, type: nodeType, title: nodeType, description: "", category: "Test", inputPorts: [], outputPorts: [], properties: [], executionKind: "generic" },
    metadata: { label: nodeType },
    properties: [],
    inputPorts: [],
    outputPorts: [],
    isEnabled: true,
  });
}

describe("ExecutionTruth", () => {
  it("classifies scaffold and delegated-capable nodes truthfully", () => {
    expect(classifyNodeTruth("langchain.prompt_template").classification).toBe("scaffolded");
    expect(classifyNodeTruth("langchain.vector_store_upsert", { delegatedRuntimeAvailable: true }).classification).toBe("hybrid");
    expect(classifyNodeTruth("mcp.tool_call", { delegatedRuntimeAvailable: true }).classification).toBe("delegated");
  });

  it("fills missing node provenance from structured node audit rules", () => {
    const provenance = ensureNodeExecutionProvenance(makeNode("langchain.prompt_template"), undefined);
    expect(provenance.classification).toBe("scaffolded");
    expect(provenance.fallback?.kind).toBe("scaffold-interpreter");
    expect(provenance.nodeType).toBe("langchain.prompt_template");
  });

  it("aggregates workflow provenance with node counts", () => {
    const result = aggregateWorkflowProvenance({
      strategyId: "infra-scaffold-langchain",
      runtime: "langchain",
      detail: "Workflow executed by scaffold interpreter.",
      nodeProvenance: {
        a: { classification: "scaffolded", executorId: "x" },
        b: { classification: "delegated", executorId: "y" },
      },
      fallback: { kind: "scaffold-interpreter", isActive: true, reason: "fallback" },
    });

    expect(result.classification).toBe("hybrid");
    expect(result.nodeCounts?.scaffolded).toBe(1);
    expect(result.nodeCounts?.delegated).toBe(1);
  });

  it("maps MCP runtime/session states into truthful MCP provenance", () => {
    expect(deriveMcpExecutionProvenance({ serverStatus: { serverId: "local", name: "Local", transport: "stdio", configured: true, enabled: true, state: "connected", sessionState: "connected", connected: true, checkedAt: "2026-03-21T00:00:00.000Z", toolCount: 1, resourceCount: 0, capabilities: {} } }).status).toBe("live");
    expect(deriveMcpExecutionProvenance({ serverStatus: { serverId: "local", name: "Local", transport: "stdio", configured: true, enabled: true, state: "disconnected", sessionState: "stale", connected: false, checkedAt: "2026-03-21T00:00:00.000Z", toolCount: 1, resourceCount: 0, capabilities: {} } }).status).toBe("stale");
  });
});
