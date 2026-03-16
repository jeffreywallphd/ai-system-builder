import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IRemoteModelCatalog,
  IRemoteModelCatalogItem,
  IRemoteModelCatalogSearchCriteria,
  IRemoteModelCatalogSearchResult,
} from "./interfaces/IRemoteModelCatalog";

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
  targets: ReadonlyArray<string> | undefined
): boolean {
  const normalizedTargets = normalizeArray(targets);

  if (normalizedTargets.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(normalizeArray(candidates));
  return normalizedTargets.some((target) => normalizedCandidates.has(target));
}

function modelMatchesCriteria(
  item: IRemoteModelCatalogItem,
  criteria?: IRemoteModelCatalogSearchCriteria
): boolean {
  if (!criteria) {
    return true;
  }

  const { model } = item;

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      model.id,
      model.name,
      model.kind,
      model.architecture,
      model.architectureFamily,
      model.description,
      model.source.type,
      item.provider,
      ...(model.tags ?? []),
      ...(model.languageCodes ?? []),
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    const queryMatched = haystack.some((value) => value.includes(query));

    if (!queryMatched) {
      return false;
    }
  }

  if (criteria.kinds && criteria.kinds.length > 0) {
    if (!criteria.kinds.includes(model.kind)) {
      return false;
    }
  }

  if (
    criteria.architectureFamilies &&
    criteria.architectureFamilies.length > 0 &&
    !model.architectureFamily
  ) {
    return false;
  }

  if (
    criteria.architectureFamilies &&
    criteria.architectureFamilies.length > 0 &&
    model.architectureFamily &&
    !includesAnyNormalized(
      [model.architectureFamily],
      criteria.architectureFamilies
    )
  ) {
    return false;
  }

  if (
    criteria.tasks &&
    criteria.tasks.length > 0 &&
    !includesAnyNormalized(model.compatibility.supportedTasks, criteria.tasks)
  ) {
    return false;
  }

  if (
    criteria.inputModalities &&
    criteria.inputModalities.length > 0 &&
    !includesAnyNormalized(
      model.compatibility.inputModalities,
      criteria.inputModalities
    )
  ) {
    return false;
  }

  if (
    criteria.outputModalities &&
    criteria.outputModalities.length > 0 &&
    !includesAnyNormalized(
      model.compatibility.outputModalities,
      criteria.outputModalities
    )
  ) {
    return false;
  }

  if (
    criteria.runtimes &&
    criteria.runtimes.length > 0 &&
    !(
      model.compatibility.allowsAnyRuntime ||
      includesAnyNormalized(
        model.compatibility.supportedRuntimes,
        criteria.runtimes
      )
    )
  ) {
    return false;
  }

  if (criteria.runnableOnly && !model.isRunnable) {
    return false;
  }

  if (criteria.installableOnly && !item.isInstallable) {
    return false;
  }

  if (
    criteria.providers &&
    criteria.providers.length > 0 &&
    !includesAnyNormalized([item.provider], criteria.providers)
  ) {
    return false;
  }

  if (
    criteria.tags &&
    criteria.tags.length > 0 &&
    !includesAnyNormalized(model.tags, criteria.tags)
  ) {
    return false;
  }

  return true;
}

function scoreItem(
  item: IRemoteModelCatalogItem,
  criteria?: IRemoteModelCatalogSearchCriteria
): number {
  if (!criteria?.query) {
    return item.isInstallable ? 10 : 0;
  }

  const query = normalize(criteria.query);
  const name = normalize(item.model.name);
  const id = normalize(item.model.id);
  const description = normalize(item.model.description ?? "");

  let score = 0;

  if (name === query) score += 200;
  if (id === query) score += 180;
  if (name.startsWith(query)) score += 100;
  if (id.startsWith(query)) score += 80;
  if (name.includes(query)) score += 60;
  if (id.includes(query)) score += 50;
  if (description.includes(query)) score += 20;
  if (item.isInstallable) score += 10;
  if (item.requiresAuth) score -= 5;

  return score;
}

function dedupeItems(
  items: ReadonlyArray<IRemoteModelCatalogItem>
): ReadonlyArray<IRemoteModelCatalogItem> {
  const deduped = new Map<string, IRemoteModelCatalogItem>();

  for (const item of items) {
    const key = `${normalize(item.provider)}::${normalize(item.remoteId ?? item.model.id)}`;
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, item);
      continue;
    }

    const existingScore =
      (existing.isInstallable ? 1 : 0) + (existing.requiresAuth ? 0 : 1);
    const currentScore =
      (item.isInstallable ? 1 : 0) + (item.requiresAuth ? 0 : 1);

    if (currentScore > existingScore) {
      deduped.set(key, item);
    }
  }

  return Object.freeze([...deduped.values()]);
}

export class RemoteModelCatalogItem implements IRemoteModelCatalogItem {
  public readonly model: IModel;
  public readonly remoteId?: string;
  public readonly provider: string;
  public readonly isInstallable: boolean;
  public readonly requiresAuth?: boolean;

  constructor(params: {
    model: IModel;
    remoteId?: string;
    provider: string;
    isInstallable?: boolean;
    requiresAuth?: boolean;
  }) {
    const provider = params.provider.trim();

    if (!provider) {
      throw new Error("RemoteModelCatalogItem.provider cannot be empty.");
    }

    this.model = params.model;
    this.remoteId = params.remoteId?.trim() || undefined;
    this.provider = provider;
    this.isInstallable = params.isInstallable ?? true;
    this.requiresAuth = params.requiresAuth;
  }

  public static from(item: IRemoteModelCatalogItem): RemoteModelCatalogItem {
    return new RemoteModelCatalogItem({
      model: item.model,
      remoteId: item.remoteId,
      provider: item.provider,
      isInstallable: item.isInstallable,
      requiresAuth: item.requiresAuth,
    });
  }
}

export class RemoteModelCatalogSearchResult
  implements IRemoteModelCatalogSearchResult
{
  public readonly items: ReadonlyArray<IRemoteModelCatalogItem>;
  public readonly nextCursor?: string;

  constructor(params: {
    items: ReadonlyArray<IRemoteModelCatalogItem>;
    nextCursor?: string;
  }) {
    this.items = Object.freeze([...params.items]);
    this.nextCursor = params.nextCursor?.trim() || undefined;
  }
}

export class RemoteModelCatalog implements IRemoteModelCatalog {
  private readonly providers: ReadonlyArray<IRemoteModelCatalog>;

  constructor(providers: ReadonlyArray<IRemoteModelCatalog> = []) {
    this.providers = Object.freeze([...providers]);
  }

  public async search(
    criteria?: IRemoteModelCatalogSearchCriteria
  ): Promise<IRemoteModelCatalogSearchResult> {
    const relevantProviders =
      criteria?.providers && criteria.providers.length > 0
        ? this.providers.filter((provider) =>
            criteria.providers!.some((candidate) =>
              provider.supportsProvider(candidate)
            )
          )
        : this.providers;

    const results = await Promise.all(
      relevantProviders.map((provider) => provider.search(criteria))
    );

    const combinedItems = dedupeItems(
      results.flatMap((result) => result.items).filter((item) =>
        modelMatchesCriteria(item, criteria)
      )
    ).sort((left, right) => scoreItem(right, criteria) - scoreItem(left, criteria));

    const limitedItems =
      criteria?.limit && criteria.limit > 0
        ? combinedItems.slice(0, criteria.limit)
        : combinedItems;

    return new RemoteModelCatalogSearchResult({
      items: limitedItems,
      nextCursor: undefined,
    });
  }

  public async getById(
    id: string,
    provider?: string
  ): Promise<IRemoteModelCatalogItem | undefined> {
    const normalizedId = normalize(id);
    const relevantProviders = provider
      ? this.providers.filter((candidate) => candidate.supportsProvider(provider))
      : this.providers;

    for (const candidate of relevantProviders) {
      const item = await candidate.getById(id, provider);

      if (item) {
        return item;
      }
    }

    const fallbackSearch = await this.search({
      query: id,
      providers: provider ? [provider] : undefined,
      limit: 50,
    });

    return fallbackSearch.items.find(
      (item) =>
        normalize(item.remoteId ?? item.model.id) === normalizedId ||
        normalize(item.model.id) === normalizedId
    );
  }

  public supportsProvider(provider: string): boolean {
    const normalizedProvider = normalize(provider);
    return this.providers.some((candidate) =>
      candidate.supportsProvider(normalizedProvider)
    );
  }
}
