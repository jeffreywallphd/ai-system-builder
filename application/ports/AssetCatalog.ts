import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type {
  IAssetCatalog,
  IAssetSearchCriteria,
} from "./interfaces/IAssetCatalog";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeArray(values?: ReadonlyArray<string>): string[] {
  if (!values || values.length === 0) {
    return [];
  }

  return [...new Set(values.map(normalize).filter(Boolean))];
}

function includesAnyNormalized(
  candidates: ReadonlyArray<string> | undefined,
  filters: ReadonlyArray<string> | undefined
): boolean {
  const normalizedFilters = normalizeArray(filters);

  if (normalizedFilters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(normalizeArray(candidates));
  return normalizedFilters.some((filter) => normalizedCandidates.has(filter));
}

function assetMatchesCriteria(asset: IAsset, criteria?: IAssetSearchCriteria): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      asset.id,
      asset.name,
      asset.kind,
      asset.status,
      asset.version,
      asset.location.location,
      asset.location.format,
      asset.location.contentType,
      asset.source.type,
      asset.source.provider,
      asset.semanticMetadata?.description,
      ...(asset.semanticMetadata?.tags ?? []),
      ...(asset.semanticMetadata?.languageCodes ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    const matched = haystack.some((value) => value.includes(query));
    if (!matched) {
      return false;
    }
  }

  if (criteria.ids && criteria.ids.length > 0 && !criteria.ids.includes(asset.id)) {
    return false;
  }

  if (criteria.kinds && criteria.kinds.length > 0 && !criteria.kinds.includes(asset.kind)) {
    return false;
  }

  if (
    criteria.statuses &&
    criteria.statuses.length > 0 &&
    !criteria.statuses.includes(asset.status)
  ) {
    return false;
  }

  if (criteria.workflowId && !asset.belongsToWorkflow(criteria.workflowId)) {
    return false;
  }

  if (criteria.nodeId && !asset.belongsToNode(criteria.nodeId)) {
    return false;
  }

  if (criteria.executionId && asset.source.executionId !== criteria.executionId.trim()) {
    return false;
  }

  if (
    criteria.parentAssetId &&
    asset.source.parentAssetId !== criteria.parentAssetId.trim()
  ) {
    return false;
  }

  if (
    criteria.sourceTypes &&
    criteria.sourceTypes.length > 0 &&
    !criteria.sourceTypes.includes(asset.source.type)
  ) {
    return false;
  }

  if (
    criteria.tags &&
    criteria.tags.length > 0 &&
    !includesAnyNormalized(asset.semanticMetadata?.tags, criteria.tags)
  ) {
    return false;
  }

  if (
    criteria.languageCodes &&
    criteria.languageCodes.length > 0 &&
    !includesAnyNormalized(asset.semanticMetadata?.languageCodes, criteria.languageCodes)
  ) {
    return false;
  }

  return true;
}

export class AssetCatalog implements IAssetCatalog {
  private readonly catalogs: ReadonlyArray<IAssetCatalog>;
  private readonly writableCatalog?: IAssetCatalog;

  constructor(params: {
    catalogs?: ReadonlyArray<IAssetCatalog>;
    writableCatalog?: IAssetCatalog;
  } = {}) {
    this.catalogs = Object.freeze([...(params.catalogs ?? [])]);
    this.writableCatalog = params.writableCatalog;
  }

  public async list(criteria?: IAssetSearchCriteria): Promise<ReadonlyArray<IAsset>> {
    const results = await Promise.all(this.catalogs.map((catalog) => catalog.list(criteria)));

    const deduped = new Map<string, IAsset>();

    for (const asset of results.flat()) {
      if (!assetMatchesCriteria(asset, criteria)) {
        continue;
      }

      const existing = deduped.get(asset.id);

      if (!existing) {
        deduped.set(asset.id, asset);
        continue;
      }

      if (asset.isAvailable() && !existing.isAvailable()) {
        deduped.set(asset.id, asset);
      }
    }

    const assets = [...deduped.values()].sort((left, right) =>
      normalize(left.name).localeCompare(normalize(right.name))
    );

    return Object.freeze(criteria?.limit && criteria.limit > 0 ? assets.slice(0, criteria.limit) : assets);
  }

  public async getById(id: string): Promise<IAsset | undefined> {
    const normalizedId = id.trim();

    for (const catalog of this.catalogs) {
      const asset = await catalog.getById(normalizedId);
      if (asset) {
        return asset;
      }
    }

    return undefined;
  }

  public async save(asset: IAsset): Promise<void> {
    const writable = this.resolveWritableCatalog();
    await writable.save(asset);
  }

  public async remove(id: string): Promise<boolean> {
    const normalizedId = id.trim();
    let removed = false;

    for (const catalog of this.catalogs) {
      removed = (await catalog.remove(normalizedId)) || removed;
    }

    return removed;
  }

  public async exists(id: string): Promise<boolean> {
    const normalizedId = id.trim();

    for (const catalog of this.catalogs) {
      if (await catalog.exists(normalizedId)) {
        return true;
      }
    }

    return false;
  }

  private resolveWritableCatalog(): IAssetCatalog {
    if (this.writableCatalog) {
      return this.writableCatalog;
    }

    if (this.catalogs.length === 1) {
      return this.catalogs[0];
    }

    throw new Error("AssetCatalog does not have a writable catalog configured.");
  }
}
