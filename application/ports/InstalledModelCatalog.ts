import type { IModel } from "../../domain/models/interfaces/IModel";
import type {
  IInstalledModelCatalog,
  IInstalledModelSearchCriteria,
} from "./interfaces/IInstalledModelCatalog";

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

function modelMatchesCriteria(
  model: IModel,
  criteria?: IInstalledModelSearchCriteria
): boolean {
  if (!criteria) {
    return true;
  }

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

  if (criteria.ids && criteria.ids.length > 0 && !criteria.ids.includes(model.id)) {
    return false;
  }

  if (criteria.kinds && criteria.kinds.length > 0 && !criteria.kinds.includes(model.kind)) {
    return false;
  }

  if (
    criteria.architectureFamilies &&
    criteria.architectureFamilies.length > 0 &&
    (!model.architectureFamily ||
      !includesAnyNormalized([model.architectureFamily], criteria.architectureFamilies))
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
    !includesAnyNormalized(model.compatibility.inputModalities, criteria.inputModalities)
  ) {
    return false;
  }

  if (
    criteria.outputModalities &&
    criteria.outputModalities.length > 0 &&
    !includesAnyNormalized(model.compatibility.outputModalities, criteria.outputModalities)
  ) {
    return false;
  }

  if (
    criteria.runtimes &&
    criteria.runtimes.length > 0 &&
    !(
      model.compatibility.allowsAnyRuntime ||
      includesAnyNormalized(model.compatibility.supportedRuntimes, criteria.runtimes)
    )
  ) {
    return false;
  }

  if (criteria.runnableOnly && !model.isRunnable) {
    return false;
  }

  if (criteria.availableOnly && !model.isAvailable()) {
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

export class InstalledModelCatalog implements IInstalledModelCatalog {
  private readonly catalogs: ReadonlyArray<IInstalledModelCatalog>;
  private readonly writableCatalog?: IInstalledModelCatalog;

  constructor(params: {
    catalogs?: ReadonlyArray<IInstalledModelCatalog>;
    writableCatalog?: IInstalledModelCatalog;
  } = {}) {
    this.catalogs = Object.freeze([...(params.catalogs ?? [])]);
    this.writableCatalog = params.writableCatalog;
  }

  public async listInstalled(
    criteria?: IInstalledModelSearchCriteria
  ): Promise<ReadonlyArray<IModel>> {
    const results = await Promise.all(
      this.catalogs.map((catalog) => catalog.listInstalled(criteria))
    );

    const deduped = new Map<string, IModel>();

    for (const model of results.flat()) {
      if (!modelMatchesCriteria(model, criteria)) {
        continue;
      }

      const existing = deduped.get(model.id);

      if (!existing) {
        deduped.set(model.id, model);
        continue;
      }

      if (model.isAvailable() && !existing.isAvailable()) {
        deduped.set(model.id, model);
      }
    }

    const items = [...deduped.values()].sort((left, right) =>
      normalize(left.name).localeCompare(normalize(right.name))
    );

    return Object.freeze(
      criteria?.limit && criteria.limit > 0
        ? items.slice(0, criteria.limit)
        : items
    );
  }

  public async getInstalledById(id: string): Promise<IModel | undefined> {
    const normalizedId = id.trim();

    for (const catalog of this.catalogs) {
      const model = await catalog.getInstalledById(normalizedId);
      if (model) {
        return model;
      }
    }

    return undefined;
  }

  public async saveInstalled(model: IModel): Promise<void> {
    const writable = this.resolveWritableCatalog();
    await writable.saveInstalled(model);
  }

  public async removeInstalled(id: string): Promise<boolean> {
    const normalizedId = id.trim();
    let removed = false;

    for (const catalog of this.catalogs) {
      removed = (await catalog.removeInstalled(normalizedId)) || removed;
    }

    return removed;
  }

  public async isInstalled(id: string): Promise<boolean> {
    const normalizedId = id.trim();

    for (const catalog of this.catalogs) {
      if (await catalog.isInstalled(normalizedId)) {
        return true;
      }
    }

    return false;
  }

  private resolveWritableCatalog(): IInstalledModelCatalog {
    if (this.writableCatalog) {
      return this.writableCatalog;
    }

    if (this.catalogs.length === 1) {
      return this.catalogs[0];
    }

    throw new Error(
      "InstalledModelCatalog does not have a writable catalog configured."
    );
  }
}
