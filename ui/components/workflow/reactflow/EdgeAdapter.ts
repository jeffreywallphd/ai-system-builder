import type { Edge } from "@xyflow/react";
import type { WorkflowResponse } from "../../../../application/dto/WorkflowResponse";

export function createReactFlowEdgeId(params: {
  readonly sourceNodeId: string;
  readonly sourcePortId: string;
  readonly targetNodeId: string;
  readonly targetPortId: string;
}): string {
  return `edge:${params.sourceNodeId}:${params.sourcePortId}:${params.targetNodeId}:${params.targetPortId}`;
}

export class EdgeAdapter {
  public toReactFlowEdges(workflow?: WorkflowResponse): ReadonlyArray<Edge> {
    if (!workflow) {
      return Object.freeze([]);
    }

    return Object.freeze(
      workflow.connections.map((connection) =>
        Object.freeze({
          id: createReactFlowEdgeId({
            sourceNodeId: connection.source.nodeId,
            sourcePortId: connection.source.portId,
            targetNodeId: connection.target.nodeId,
            targetPortId: connection.target.portId,
          }),
          source: connection.source.nodeId,
          sourceHandle: connection.source.portId,
          target: connection.target.nodeId,
          targetHandle: connection.target.portId,
          type: "smoothstep",
          animated: false,
          selectable: true,
          data: Object.freeze({
            connectionId: connection.id,
            kind: connection.kind,
            state: connection.state,
            isEnabled: connection.isEnabled,
          }),
        })
      )
    );
  }
}
