import type { INodeRuntimeImplementation } from "./INodeRuntimeImplementation";

export interface INodeImplementationSearchOptions {
  readonly providerId?: string;
}

export interface INodeImplementationRegistry {
  getProviderId(): string;

  listImplementations(
    options?: INodeImplementationSearchOptions
  ): ReadonlyArray<INodeRuntimeImplementation>;

  findByNodeType(
    nodeTypeId: string,
    options?: INodeImplementationSearchOptions
  ): INodeRuntimeImplementation | undefined;
}
