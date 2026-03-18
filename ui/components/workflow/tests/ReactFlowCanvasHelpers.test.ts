import { describe, expect, it } from "bun:test";
import type { Connection, Edge } from "@xyflow/react";
import { createReactFlowEdgeId } from "../reactflow/EdgeAdapter";
import {
  createOptimisticEdgeFromConnection,
  syncInteractiveEdges,
} from "../reactflow/ReactFlowCanvas";

describe("ui/components/workflow/reactflow/ReactFlowCanvas helpers", () => {
  it("creates an optimistic edge for a completed port connection", () => {
    const connection: Connection = {
      source: "source-node",
      sourceHandle: "output-port",
      target: "target-node",
      targetHandle: "input-port",
    };

    expect(createOptimisticEdgeFromConnection(connection)).toEqual({
      id: "edge:source-node:output-port:target-node:input-port",
      source: "source-node",
      sourceHandle: "output-port",
      target: "target-node",
      targetHandle: "input-port",
      type: "smoothstep",
      animated: true,
      selectable: false,
      data: {
        connectionId: undefined,
        state: "pending",
        isOptimistic: true,
      },
    });
  });

  it("ignores incomplete connections when building optimistic edges", () => {
    const connection: Connection = {
      source: "source-node",
      sourceHandle: null,
      target: "target-node",
      targetHandle: "input-port",
    };

    expect(createOptimisticEdgeFromConnection(connection)).toBeUndefined();
  });

  it("reconciles optimistic edges with authoritative workflow edges", () => {
    const pendingEdge = createOptimisticEdgeFromConnection({
      source: "source-node",
      sourceHandle: "output-port",
      target: "target-node",
      targetHandle: "input-port",
    });

    const renderedEdge: Edge = {
      id: createReactFlowEdgeId({
        sourceNodeId: "source-node",
        sourcePortId: "output-port",
        targetNodeId: "target-node",
        targetPortId: "input-port",
      }),
      source: "source-node",
      sourceHandle: "output-port",
      target: "target-node",
      targetHandle: "input-port",
      type: "smoothstep",
      animated: false,
      selectable: true,
      selected: true,
      data: {
        connectionId: "connection-1",
        state: "active",
      },
    };

    expect(syncInteractiveEdges([pendingEdge!], [renderedEdge])).toEqual([
      renderedEdge,
    ]);
  });
});
