import { ContextPackage } from "@application/context/models/ContextPackage";
import type {
  IContextPackageListCriteria,
  IContextPackageRepository,
  IContextPackageSummary,
} from "@application/ports/interfaces/IContextPackageRepository";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(
  candidates: ReadonlyArray<string>,
  filters?: ReadonlyArray<string>
): boolean {
  if (!filters || filters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(candidates.map(normalize));
  return filters.some((filter) => normalizedCandidates.has(normalize(filter)));
}

function matchesCriteria(
  contextPackage: ContextPackage,
  criteria?: IContextPackageListCriteria
): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      contextPackage.id,
      contextPackage.name,
      contextPackage.description,
      contextPackage.version,
      ...contextPackage.tags,
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  return includesAny(contextPackage.tags, criteria.tags);
}

function toSummary(contextPackage: ContextPackage): IContextPackageSummary {
  return Object.freeze({
    id: contextPackage.id,
    name: contextPackage.name,
    description: contextPackage.description,
    version: contextPackage.version,
    tags: contextPackage.tags,
    fragmentCount: contextPackage.fragments.length,
    updatedAt: contextPackage.audit?.updatedAt,
  });
}

export class InMemoryContextPackageRepository implements IContextPackageRepository {
  private readonly contextPackages = new Map<string, ContextPackage>();

  constructor(initialPackages: ReadonlyArray<ContextPackage> = []) {
    for (const contextPackage of initialPackages) {
      this.contextPackages.set(contextPackage.id, ContextPackage.from(contextPackage));
    }
  }

  public async save(contextPackage: ContextPackage): Promise<ContextPackage> {
    const savedContextPackage = ContextPackage.from(contextPackage);
    this.contextPackages.set(savedContextPackage.id, savedContextPackage);
    return savedContextPackage;
  }

  public async load(id: string): Promise<ContextPackage | undefined> {
    const contextPackage = this.contextPackages.get(id.trim());
    return contextPackage ? ContextPackage.from(contextPackage) : undefined;
  }

  public async list(
    criteria?: IContextPackageListCriteria
  ): Promise<ReadonlyArray<IContextPackageSummary>> {
    const contextPackages = [...this.contextPackages.values()]
      .filter((contextPackage) => matchesCriteria(contextPackage, criteria))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(toSummary);

    return Object.freeze(
      criteria?.limit && criteria.limit > 0
        ? contextPackages.slice(0, criteria.limit)
        : contextPackages
    );
  }

  public async exists(id: string): Promise<boolean> {
    return this.contextPackages.has(id.trim());
  }

  public async delete(id: string): Promise<void> {
    this.contextPackages.delete(id.trim());
  }
}

