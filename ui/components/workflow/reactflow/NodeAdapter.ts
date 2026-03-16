import type { Node } from "@xyflow/react";
import type { NodeDetailViewModel } from "../../../presenters/NodePresenter";

export interface ReactFlowNodeData {
  readonly node: NodeDetailViewModel;
}

export class NodeAdapter {
  public toReactFlowNode(node: NodeDetailViewModel): Node<ReactFlowNodeData> {
    return Object.freeze({
      id: node.id,
      type: "aiLoomNode",
      position: {
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
      },
      data: Object.freeze({
        node,
      }),
      draggable: true,
      selectable: true,
    });
  }

  public toReactFlowNodes(
    nodes: ReadonlyArray<NodeDetailViewModel>
  ): ReadonlyArray<Node<ReactFlowNodeData>> {
    return Object.freeze(nodes.map((node) => this.toReactFlowNode(node)));
  }
}
