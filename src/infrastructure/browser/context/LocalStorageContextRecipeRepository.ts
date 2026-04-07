import { ContextRecipe } from "../../../application/context/models/ContextRecipe";
import { ContextPackageReference } from "../../../application/context/models/ContextPackageReference";
import type {
  IContextRecipeListCriteria,
  IContextRecipeRepository,
  IContextRecipeSummary,
} from "../../../application/ports/interfaces/IContextRecipeRepository";

interface ContextRecipeRecord {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly packageReferences?: ReadonlyArray<{
    readonly packageId: string;
    readonly alias?: string;
    readonly version?: string;
    readonly fragmentIds?: ReadonlyArray<string>;
  }>;
  readonly dynamicSourcePreferences?: ContextRecipe["dynamicSourcePreferences"];
  readonly budgetingDefaults?: ContextRecipe["budgetingDefaults"];
  readonly guidance?: ContextRecipe["guidance"];
  readonly toolUseGuidance?: ContextRecipe["toolUseGuidance"];
  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };
}

const defaultStorageKey = "ai-loom-studio.context-recipes";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(candidates: ReadonlyArray<string>, filters?: ReadonlyArray<string>): boolean {
  if (!filters || filters.length === 0) {
    return true;
  }

  const normalizedCandidates = new Set(candidates.map(normalize));
  return filters.some((filter) => normalizedCandidates.has(normalize(filter)));
}

function matchesCriteria(record: ContextRecipeRecord, criteria?: IContextRecipeListCriteria): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [record.id, record.name, record.description, record.version, ...(record.tags ?? [])]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  return includesAny(record.tags ?? [], criteria.tags);
}

export class LocalStorageContextRecipeRepository implements IContextRecipeRepository {
  constructor(
    private readonly storageKey = defaultStorageKey,
    private readonly storage = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {}

  public async save(contextRecipe: ContextRecipe): Promise<ContextRecipe> {
    const records = await this.readRecords();
    records.set(contextRecipe.id, this.toRecord(contextRecipe));
    this.writeRecords(records);
    return ContextRecipe.from(contextRecipe);
  }

  public async load(id: string): Promise<ContextRecipe | undefined> {
    const record = (await this.readRecords()).get(id.trim());
    return record ? this.toDomain(record) : undefined;
  }

  public async list(criteria?: IContextRecipeListCriteria): Promise<ReadonlyArray<IContextRecipeSummary>> {
    const summaries = [...(await this.readRecords()).values()]
      .filter((record) => matchesCriteria(record, criteria))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((record) => this.toSummary(record));

    return Object.freeze(criteria?.limit && criteria.limit > 0 ? summaries.slice(0, criteria.limit) : summaries);
  }

  public async exists(id: string): Promise<boolean> {
    return (await this.readRecords()).has(id.trim());
  }

  public async delete(id: string): Promise<void> {
    const records = await this.readRecords();
    records.delete(id.trim());
    this.writeRecords(records);
  }

  private async readRecords(): Promise<Map<string, ContextRecipeRecord>> {
    const raw = this.storage?.getItem(this.storageKey);
    if (!raw) {
      return new Map<string, ContextRecipeRecord>();
    }

    try {
      const parsed = JSON.parse(raw) as ReadonlyArray<ContextRecipeRecord>;
      return new Map(parsed.map((record) => [record.id, record]));
    } catch {
      return new Map<string, ContextRecipeRecord>();
    }
  }

  private writeRecords(records: Map<string, ContextRecipeRecord>): void {
    this.storage?.setItem(this.storageKey, JSON.stringify([...records.values()], null, 2));
  }

  private toSummary(record: ContextRecipeRecord): IContextRecipeSummary {
    return Object.freeze({
      id: record.id,
      name: record.name,
      description: record.description,
      version: record.version,
      tags: Object.freeze([...(record.tags ?? [])]),
      packageReferenceCount: (record.packageReferences ?? []).length,
      updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
    });
  }

  private toRecord(contextRecipe: ContextRecipe): ContextRecipeRecord {
    return {
      id: contextRecipe.id,
      name: contextRecipe.name,
      description: contextRecipe.description,
      version: contextRecipe.version,
      tags: contextRecipe.tags,
      packageReferences: contextRecipe.packageReferences.map((reference) => ({
        packageId: reference.packageId,
        alias: reference.alias,
        version: reference.version,
        fragmentIds: reference.fragmentIds,
      })),
      dynamicSourcePreferences: contextRecipe.dynamicSourcePreferences,
      budgetingDefaults: contextRecipe.budgetingDefaults,
      guidance: contextRecipe.guidance,
      toolUseGuidance: contextRecipe.toolUseGuidance,
      audit: contextRecipe.audit
        ? {
            createdAt: contextRecipe.audit.createdAt?.toISOString(),
            updatedAt: contextRecipe.audit.updatedAt?.toISOString(),
          }
        : undefined,
    };
  }

  private toDomain(record: ContextRecipeRecord): ContextRecipe {
    return new ContextRecipe({
      id: record.id,
      name: record.name,
      description: record.description,
      version: record.version,
      tags: record.tags,
      packageReferences: (record.packageReferences ?? []).map((reference) => new ContextPackageReference(reference)),
      dynamicSourcePreferences: record.dynamicSourcePreferences,
      budgetingDefaults: record.budgetingDefaults,
      guidance: record.guidance,
      toolUseGuidance: record.toolUseGuidance,
      audit: {
        createdAt: record.audit?.createdAt ? new Date(record.audit.createdAt) : undefined,
        updatedAt: record.audit?.updatedAt ? new Date(record.audit.updatedAt) : undefined,
      },
    });
  }
}
