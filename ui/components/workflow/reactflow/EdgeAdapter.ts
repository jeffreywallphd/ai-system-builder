import type { Edge } from "@xyflow/react";
import type { WorkflowResponse } from "../../../../application/dto/WorkflowResponse";

export class EdgeAdapter {
  public toReactFlowEdges(workflow?: WorkflowResponse): ReadonlyArray<Edge> {
    if (!workflow) {
      return Object.freeze([]);
    }

    return Object.freeze(
      workflow.connections.map((connection) =>
        Object.freeze({
          id: connection.id,
          source: connection.source.nodeId,
          sourceHandle: connection.source.portId,
          target: connection.target.nodeId,
          targetHandle: connection.target.portId,
          type: "smoothstep",
          animated: false,
          selectable: true,
          data: Object.freeze({
            kind: connection.kind,
            state: connection.state,
            isEnabled: connection.isEnabled,
          }),
        })
      )
    );
  }
}
