import { describe, expect, it } from "bun:test";
import {
  attachExecutionNode,
  createSystemExecution,
  ExecutionStatusKinds,
  isTerminalExecutionStatus,
  transitionSystemExecutionStatus,
} from "../SystemRuntimeDomain";

describe("SystemRuntimeDomain", () => {
  it("keeps runtime execution state separate from asset-definition models", () => {
    const execution = createSystemExecution({
      executionId: "exec-1",
      root: {
        assetId: "asset:system-root",
        versionId: "asset:system-root:v1",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "iterative",
        },
      },
      input: {
        payload: { prompt: "hello" },
        capturedAt: "2026-03-28T00:00:00.000Z",
      },
      startedAt: "2026-03-28T00:00:00.000Z",
    });

    expect(execution.executionId).toBe("exec-1");
    expect((execution as any).metadata).toBeUndefined();
    expect(execution.root.assetId).toBe("asset:system-root");
    expect(execution.status).toBe(ExecutionStatusKinds.pending);
  });

  it("references atomic/composite/system assets through execution nodes", () => {
    const execution = createSystemExecution({
      executionId: "exec-2",
      root: {
        assetId: "asset:system-root",
        versionId: "asset:system-root:v2",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "autonomous",
        },
      },
      nodes: [
        {
          executionNodeId: "node-atomic",
          path: ["node-atomic"],
          target: {
            assetId: "asset:model",
            versionId: "asset:model:v1",
            taxonomy: {
              structuralKind: "atomic",
              semanticRole: "model",
              behaviorKind: "none",
            },
          },
        },
        {
          executionNodeId: "node-composite",
          path: ["node-composite"],
          target: {
            assetId: "asset:workflow",
            versionId: "asset:workflow:v5",
            taxonomy: {
              structuralKind: "composite",
              semanticRole: "workflow",
              behaviorKind: "conditional",
            },
          },
        },
      ],
      input: {
        payload: { query: "state" },
        capturedAt: "2026-03-28T00:00:00.000Z",
      },
      startedAt: "2026-03-28T00:00:00.000Z",
    });

    expect(execution.nodes.map((entry) => entry.target.taxonomy.structuralKind)).toEqual(["atomic", "composite"]);
    const withSystemNode = attachExecutionNode({
      execution,
      node: {
        executionNodeId: "node-system-child",
        parentExecutionNodeId: "node-composite",
        path: ["node-composite", "node-system-child"],
        target: {
          assetId: "asset:system-child",
          versionId: "asset:system-child:v1",
          taxonomy: {
            structuralKind: "system",
            semanticRole: "system",
            behaviorKind: "deterministic",
          },
        },
      },
      updatedAt: "2026-03-28T00:01:00.000Z",
    });

    expect(withSystemNode.nodes[2]?.target.taxonomy.structuralKind).toBe("system");
    expect(withSystemNode.nodes[2]?.parentExecutionNodeId).toBe("node-composite");
  });

  it("enforces coherent execution status transitions", () => {
    const pending = createSystemExecution({
      executionId: "exec-3",
      root: {
        assetId: "asset:workflow",
        taxonomy: {
          structuralKind: "composite",
          semanticRole: "workflow",
          behaviorKind: "iterative",
        },
      },
      input: {
        payload: { seed: 42 },
        capturedAt: "2026-03-28T10:00:00.000Z",
      },
      startedAt: "2026-03-28T10:00:00.000Z",
    });

    const running = transitionSystemExecutionStatus({
      execution: pending,
      nextStatus: ExecutionStatusKinds.running,
      updatedAt: "2026-03-28T10:00:30.000Z",
    });
    const succeeded = transitionSystemExecutionStatus({
      execution: running,
      nextStatus: ExecutionStatusKinds.succeeded,
      updatedAt: "2026-03-28T10:01:00.000Z",
      output: {
        payload: { ok: true },
        producedAt: "2026-03-28T10:01:00.000Z",
      },
    });

    expect(running.status).toBe("running");
    expect(succeeded.status).toBe("succeeded");
    expect(isTerminalExecutionStatus(succeeded.status)).toBe(true);
    expect(() => transitionSystemExecutionStatus({
      execution: succeeded,
      nextStatus: ExecutionStatusKinds.running,
      updatedAt: "2026-03-28T10:02:00.000Z",
    })).toThrow("cannot transition");
  });

  it("supports nested-system-ready node references without orchestration", () => {
    const execution = createSystemExecution({
      executionId: "exec-4",
      root: {
        assetId: "asset:system-root",
        versionId: "asset:system-root:v3",
        taxonomy: {
          structuralKind: "system",
          semanticRole: "app-template",
          behaviorKind: "conditional",
        },
      },
      nodes: [
        {
          executionNodeId: "root-system-node",
          path: ["root-system-node"],
          target: {
            assetId: "asset:system-root",
            versionId: "asset:system-root:v3",
            taxonomy: {
              structuralKind: "system",
              semanticRole: "app-template",
              behaviorKind: "conditional",
            },
          },
        },
      ],
      input: {
        payload: { requestId: "req-1" },
        capturedAt: "2026-03-28T12:00:00.000Z",
      },
      startedAt: "2026-03-28T12:00:00.000Z",
    });

    const nested = attachExecutionNode({
      execution,
      node: {
        executionNodeId: "nested-system-node",
        parentExecutionNodeId: "root-system-node",
        path: ["root-system-node", "nested-system-node"],
        target: {
          assetId: "asset:system-child",
          versionId: "asset:system-child:v9",
          taxonomy: {
            structuralKind: "system",
            semanticRole: "system",
            behaviorKind: "autonomous",
          },
        },
      },
      updatedAt: "2026-03-28T12:00:10.000Z",
    });

    expect(nested.nodes).toHaveLength(2);
    expect(nested.nodes[1]?.path).toEqual(["root-system-node", "nested-system-node"]);
    expect(nested.nodes[1]?.target.assetId).toBe("asset:system-child");
  });
});
