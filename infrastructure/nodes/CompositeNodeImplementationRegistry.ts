import type {
  INodeImplementationRegistry,
  INodeImplementationSearchOptions,
} from "./shared/INodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "./shared/INodeRuntimeImplementation";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export class CompositeNodeImplementationRegistry implements INodeImplementationRegistry {
  private readonly registries: ReadonlyArray<INodeImplementationRegistry>;

  constructor(registries: ReadonlyArray<INodeImplementationRegistry>) {
    this.registries = Object.freeze([...registries]);
  }

  public getProviderId(): string {
    return "composite";
  }

  public listImplementations(
    options?: INodeImplementationSearchOptions
  ): ReadonlyArray<INodeRuntimeImplementation> {
    if (options?.providerId) {
      return Object.freeze(
        this.registries.flatMap((registry) =>
          normalize(registry.getProviderId()) === normalize(options.providerId!)
            ? [...registry.listImplementations(options)]
            : []
        )
      );
    }

    return Object.freeze(
      this.registries.flatMap((registry) => [...registry.listImplementations()])
    );
  }

  public findByNodeType(
    nodeTypeId: string,
    options?: INodeImplementationSearchOptions
  ): INodeRuntimeImplementation | undefined {
    for (const registry of this.registries) {
      if (
        options?.providerId &&
        normalize(registry.getProviderId()) !== normalize(options.providerId)
      ) {
        continue;
      }

      const implementation = registry.findByNodeType(nodeTypeId, options);
      if (implementation) {
        return implementation;
      }
    }

    return undefined;
  }
}
