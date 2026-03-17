import type { Node } from "@xyflow/react";
import type { NodeDetailViewModel } from "../../../presenters/NodePresenter";

export interface ReactFlowNodeData {
  readonly node: NodeDetailViewModel;
  readonly isCompactViewport: boolean;
  readonly executionOutput?: Readonly<Record<string, unknown>>;
  readonly onOpenProperties?: (nodeId: string) => void;
  readonly onPropertyChange?: (
    nodeId: string,
    propertyId: string,
    value: unknown
  ) => void;
  readonly onRemoveNode?: (nodeId: string) => void;
}

export interface NodeAdapterOptions {
  readonly isCompactViewport?: boolean;
  readonly nodeExecutionOutputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly onOpenProperties?: (nodeId: string) => void;
  readonly onPropertyChange?: (
    nodeId: string,
    propertyId: string,
    value: unknown
  ) => void;
  readonly onRemoveNode?: (nodeId: string) => void;
}

export class NodeAdapter {
  public toReactFlowNode(
    node: NodeDetailViewModel,
    options: NodeAdapterOptions = {}
  ): Node<ReactFlowNodeData> {
    return Object.freeze({
      id: node.id,
      type: "aiLoomNode",
      position: {
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
      },
      data: Object.freeze({
        node,
        isCompactViewport: options.isCompactViewport ?? false,
        executionOutput: options.nodeExecutionOutputs?.[node.id],
        onOpenProperties: options.onOpenProperties,
        onPropertyChange: options.onPropertyChange,
        onRemoveNode: options.onRemoveNode,
      }),
      draggable: true,
      selectable: true,
      dragHandle: ".ui-rf-node__header",
    });
  }

  public toReactFlowNodes(
    nodes: ReadonlyArray<NodeDetailViewModel>,
    options: NodeAdapterOptions = {}
  ): ReadonlyArray<Node<ReactFlowNodeData>> {
    return Object.freeze(
      nodes.map((node) => this.toReactFlowNode(node, options))
    );
  }
}
