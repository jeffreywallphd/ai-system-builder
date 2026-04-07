import type { NodeImplementationDescriptor } from "./NodeImplementationDescriptor";

export interface INodeRuntimeImplementation {
  readonly descriptor: NodeImplementationDescriptor;
}
