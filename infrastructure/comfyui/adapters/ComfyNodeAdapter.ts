import type { INode } from "../../../domain/nodes/interfaces/INode";
import type { INodePort } from "../../../domain/nodes/interfaces/INodePort";
import type { ComfyNodeDto } from "../dto/ComfyNodeDto";
import { ComfyPropertyAdapter } from "./ComfyPropertyAdapter";

export class ComfyNodeAdapter {
  private readonly propertyAdapter: ComfyPropertyAdapter;

  constructor(propertyAdapter?: ComfyPropertyAdapter) {
    this.propertyAdapter = propertyAdapter ?? new ComfyPropertyAdapter();
  }

  public adaptNode(node: INode): ComfyNodeDto {
    const classType = node.definition.type.trim();

    if (!classType) {
      throw new Error(`Node '${node.id}' does not have a valid ComfyUI class type.`);
    }

    return Object.freeze({
      class_type: classType,
      inputs: this.propertyAdapter.adaptProperties(node.properties),
    });
  }

  public getOutputPortIndex(node: INode, portId: string): number {
    const orderedPorts = this.getOrderedPorts(node.outputPorts);
    const index = orderedPorts.findIndex((port) => port.id === portId);

    if (index < 0) {
      throw new Error(`Output port '${portId}' was not found on node '${node.id}'.`);
    }

    return index;
  }

  public getInputName(node: INode, portId: string): string {
    const port = node.getInputPort(portId);

    if (!port) {
      throw new Error(`Input port '${portId}' was not found on node '${node.id}'.`);
    }

    return port.id;
  }

  private getOrderedPorts(ports: ReadonlyArray<INodePort>): ReadonlyArray<INodePort> {
    return [...ports].sort((left, right) => {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return left.id.localeCompare(right.id);
    });
  }
}
