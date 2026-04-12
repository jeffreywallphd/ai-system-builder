import type {
  INodeImplementationRegistry,
  INodeImplementationSearchOptions,
} from "./INodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "./INodeRuntimeImplementation";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export interface INodeImplementationRegistryProps {
  readonly providerId: string;
  readonly implementations?: ReadonlyArray<INodeRuntimeImplementation>;
}

export class NodeImplementationRegistry implements INodeImplementationRegistry {
  private readonly providerId: string;
  private readonly implementations: ReadonlyArray<INodeRuntimeImplementation>;

  constructor(props: INodeImplementationRegistryProps) {
    this.providerId = props.providerId;
    this.implementations = Object.freeze([...(props.implementations ?? [])]);
  }

  public getProviderId(): string {
    return this.providerId;
  }

  public listImplementations(
    options?: INodeImplementationSearchOptions
  ): ReadonlyArray<INodeRuntimeImplementation> {
    if (!options?.providerId) {
      return this.implementations;
    }

    const expectedProvider = normalize(options.providerId);
    return Object.freeze(
      this.implementations.filter(
        (implementation) => normalize(implementation.descriptor.providerId) === expectedProvider
      )
    );
  }

  public findByNodeType(
    nodeTypeId: string,
    options?: INodeImplementationSearchOptions
  ): INodeRuntimeImplementation | undefined {
    const expectedType = normalize(nodeTypeId);
    const expectedProvider = options?.providerId ? normalize(options.providerId) : undefined;

    return this.implementations.find((implementation) => {
      if (expectedProvider) {
        const providerMatches =
          normalize(implementation.descriptor.providerId) === expectedProvider;
        if (!providerMatches) {
          return false;
        }
      }

      return normalize(implementation.descriptor.nodeTypeId) === expectedType;
    });
  }
}
