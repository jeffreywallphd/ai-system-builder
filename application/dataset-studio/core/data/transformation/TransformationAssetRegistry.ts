import type {
  ITransformationAsset,
  ITransformationConfig,
  ITransformationInput,
  ITransformationOutput,
} from "./TransformationContracts";

export interface TransformationAssetRegistryDescriptor {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
}

export interface TransformationAssetRegistryEntry {
  readonly descriptor: TransformationAssetRegistryDescriptor;
  readonly asset: ITransformationAsset;
}

export class TransformationAssetRegistry {
  private readonly entriesByKey = new Map<string, TransformationAssetRegistryEntry>();
  private readonly keysByAssetId = new Map<string, ReadonlyArray<string>>();

  public register<TInput extends ITransformationInput, TOutput extends ITransformationOutput, TConfig extends ITransformationConfig>(
    asset: ITransformationAsset<TInput, TOutput, TConfig>,
  ): TransformationAssetRegistryEntry {
    const id = asset.id.trim();
    const version = asset.version.trim();
    if (!id) {
      throw new Error("Transformation asset id is required.");
    }
    if (!version) {
      throw new Error("Transformation asset version is required.");
    }

    const key = `${id}::${version}`;
    if (this.entriesByKey.has(key)) {
      throw new Error(`Transformation asset '${id}' version '${version}' is already registered.`);
    }

    const entry = Object.freeze({
      descriptor: Object.freeze({
        id,
        name: asset.name,
        description: asset.description,
        version,
      }),
      asset,
    } satisfies TransformationAssetRegistryEntry);

    this.entriesByKey.set(key, entry);
    const existingKeys = this.keysByAssetId.get(id) ?? Object.freeze([]);
    this.keysByAssetId.set(id, Object.freeze([...existingKeys, key]));
    return entry;
  }

  public get(query: { readonly id: string; readonly version?: string }): TransformationAssetRegistryEntry | undefined {
    const key = this.resolveKey(query);
    if (!key) {
      return undefined;
    }
    return this.entriesByKey.get(key);
  }

  public list(): ReadonlyArray<TransformationAssetRegistryEntry> {
    return Object.freeze([...this.entriesByKey.values()].sort((left, right) =>
      `${left.descriptor.id}@${left.descriptor.version}`.localeCompare(`${right.descriptor.id}@${right.descriptor.version}`)));
  }

  private resolveKey(query: { readonly id: string; readonly version?: string }): string | undefined {
    const id = query.id.trim();
    if (!id) {
      return undefined;
    }

    const version = query.version?.trim();
    if (version) {
      return `${id}::${version}`;
    }

    const keys = this.keysByAssetId.get(id);
    if (!keys || keys.length === 0) {
      return undefined;
    }

    return Object.freeze([...keys]).sort((left, right) => left.localeCompare(right)).at(-1);
  }
}
