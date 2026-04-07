import type {
  INodeImplementationRegistry,
  INodeImplementationSearchOptions,
} from "./shared/INodeImplementationRegistry";
import type { INodeRuntimeImplementation } from "./shared/INodeRuntimeImplementation";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export interface ICompositeNodeImplementationRegistryEntry {
  readonly registry: INodeImplementationRegistry;
  readonly precedence: number;
}

interface IResolvedCompositeNodeImplementationRegistryEntry
  extends ICompositeNodeImplementationRegistryEntry {
  readonly declarationOrder: number;
}

function isCompositeRegistryEntry(
  value: INodeImplementationRegistry | ICompositeNodeImplementationRegistryEntry
): value is ICompositeNodeImplementationRegistryEntry {
  return "registry" in value;
}

export class CompositeNodeImplementationRegistry implements INodeImplementationRegistry {
  private readonly entries: ReadonlyArray<IResolvedCompositeNodeImplementationRegistryEntry>;

  /**
   * Duplicate node types are resolved by explicit composite precedence.
   *
   * The registry with the highest numeric `precedence` wins. When two registries
   * share the same precedence, declaration order is used as a deterministic
   * tiebreaker, so the earlier entry wins.
   *
   * Plain registries are accepted for compatibility and default to precedence 0.
   */
  constructor(
    registries: ReadonlyArray<
      INodeImplementationRegistry | ICompositeNodeImplementationRegistryEntry
    >
  ) {
    this.entries = Object.freeze(
      registries
        .map((entry, declarationOrder) => {
          if (isCompositeRegistryEntry(entry)) {
            return {
              registry: entry.registry,
              precedence: entry.precedence,
              declarationOrder,
            };
          }

          return {
            registry: entry,
            precedence: 0,
            declarationOrder,
          };
        })
        .sort((left, right) => {
          const precedenceDelta = right.precedence - left.precedence;
          if (precedenceDelta !== 0) {
            return precedenceDelta;
          }

          return left.declarationOrder - right.declarationOrder;
        })
    );
  }

  public getProviderId(): string {
    return "composite";
  }

  public listImplementations(
    options?: INodeImplementationSearchOptions
  ): ReadonlyArray<INodeRuntimeImplementation> {
    if (options?.providerId) {
      return Object.freeze(
        this.entries.flatMap(({ registry }) =>
          normalize(registry.getProviderId()) === normalize(options.providerId!)
            ? [...registry.listImplementations(options)]
            : []
        )
      );
    }

    return Object.freeze(
      this.entries.flatMap(({ registry }) => [...registry.listImplementations()])
    );
  }

  public findByNodeType(
    nodeTypeId: string,
    options?: INodeImplementationSearchOptions
  ): INodeRuntimeImplementation | undefined {
    for (const { registry } of this.entries) {
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
