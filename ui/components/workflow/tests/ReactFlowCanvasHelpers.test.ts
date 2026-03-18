import { describe, expect, it } from "bun:test";
import type { Connection, Edge } from "@xyflow/react";
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
      id: "pending:source-node:output-port:target-node:input-port",
      source: "source-node",
      sourceHandle: "output-port",
      target: "target-node",
      targetHandle: "input-port",
      type: "smoothstep",
      animated: true,
      selectable: false,
      data: {
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
      id: "connection-1",
      source: "source-node",
      sourceHandle: "output-port",
      target: "target-node",
      targetHandle: "input-port",
      type: "smoothstep",
      animated: false,
      selectable: true,
      selected: true,
      data: {
        state: "active",
      },
    };

    expect(syncInteractiveEdges([pendingEdge!], [renderedEdge])).toEqual([
      renderedEdge,
    ]);
  });
});
