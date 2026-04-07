import { Node } from "../../nodes/Node";
import { NodeDefinition } from "../../nodes/NodeDefinition";
import { NodePort, NodePortCompatibilityProfile } from "../../nodes/NodePort";
import { NodeProperty } from "../../nodes/NodeProperty";
import { WorkflowConnection } from "../WorkflowConnection";
import type { INode } from "../../nodes/interfaces/INode";
import type { NodePortCardinality, NodePortValueType } from "../../nodes/interfaces/INodePort";

export function makeNode(params: {
  id: string;
  inputPortId?: string;
  outputPortId?: string;
  inputValueType?: NodePortValueType;
  outputValueType?: NodePortValueType;
  inputCardinality?: NodePortCardinality;
  invalidProperty?: boolean;
}): INode {
  const inputPortId = params.inputPortId ?? "in";
  const outputPortId = params.outputPortId ?? "out";

  const definition = new NodeDefinition({
    id: `def-${params.id}`,
    type: "test",
    title: "Test",
    category: "utility",
    executionKind: "generic",
    properties: [
      new NodeProperty({
        id: "required",
        name: "Required",
        type: "text",
        value: params.invalidProperty ? "" : "ok",
        constraints: { required: true },
      }),
    ],
    inputPorts: [
      new NodePort({
        id: inputPortId,
        name: "Input",
        direction: "input",
        cardinality: params.inputCardinality ?? "one",
        compatibility: new NodePortCompatibilityProfile({
          valueTypes: [params.inputValueType ?? "text"],
          isOptional: true,
        }),
      }),
    ],
    outputPorts: [
      new NodePort({
        id: outputPortId,
        name: "Output",
        direction: "output",
        compatibility: new NodePortCompatibilityProfile({
          valueTypes: [params.outputValueType ?? "text"],
          isOptional: true,
        }),
      }),
    ],
  });

  return new Node({ id: params.id, definition });
}

export function makeConnection(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourcePortId = "out",
  targetPortId = "in"
): WorkflowConnection {
  return new WorkflowConnection({
    id,
    source: { nodeId: sourceNodeId, portId: sourcePortId },
    target: { nodeId: targetNodeId, portId: targetPortId },
  });
}
