import path from "node:path";
import { ContextRecipe } from "@application/context/models/ContextRecipe";
import { ContextPackageReference } from "@application/context/models/ContextPackageReference";
import type {
  IContextRecipeListCriteria,
  IContextRecipeRepository,
  IContextRecipeSummary,
} from "@application/ports/interfaces/IContextRecipeRepository";
import type { IFileStorage } from "@application/ports/interfaces/IFileStorage";

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

export class LocalContextRecipeRepository implements IContextRecipeRepository {
  constructor(
    private readonly params: { fileStorage: IFileStorage; rootDirectory: string }
  ) {}

  public async save(contextRecipe: ContextRecipe): Promise<ContextRecipe> {
    const filePath = this.resolveContextRecipePath(contextRecipe.id);
    await this.params.fileStorage.write({
      path: filePath,
      content: JSON.stringify(this.toRecord(contextRecipe), null, 2),
      createDirectories: true,
      overwrite: true,
    });

    return ContextRecipe.from(contextRecipe);
  }

  public async load(id: string): Promise<ContextRecipe | undefined> {
    const filePath = this.resolveContextRecipePath(id);

    if (!(await this.params.fileStorage.exists(filePath))) {
      return undefined;
    }

    const content = await this.params.fileStorage.readText(filePath, "utf-8");
    return this.toDomain(JSON.parse(content) as ContextRecipeRecord);
  }

  public async list(criteria?: IContextRecipeListCriteria): Promise<ReadonlyArray<IContextRecipeSummary>> {
    const info = await this.params.fileStorage.stat(this.params.rootDirectory);
    if (info.kind === "missing") {
      return Object.freeze([]);
    }

    const entries = await this.params.fileStorage.list(this.params.rootDirectory, {
      recursive: false,
      includeHidden: false,
    });

    const summaries: IContextRecipeSummary[] = [];

    for (const entry of entries) {
      if (entry.kind !== "file" || !entry.path.endsWith(".json")) {
        continue;
      }

      const record = JSON.parse(await this.params.fileStorage.readText(entry.path, "utf-8")) as ContextRecipeRecord;
      if (!matchesCriteria(record, criteria)) {
        continue;
      }
      summaries.push(this.toSummary(record));
    }

    const sorted = summaries.sort((left, right) => left.name.localeCompare(right.name));
    return Object.freeze(criteria?.limit && criteria.limit > 0 ? sorted.slice(0, criteria.limit) : sorted);
  }

  public async exists(id: string): Promise<boolean> {
    return this.params.fileStorage.exists(this.resolveContextRecipePath(id));
  }

  public async delete(id: string): Promise<void> {
    const filePath = this.resolveContextRecipePath(id);
    if (!(await this.params.fileStorage.exists(filePath))) {
      return;
    }
    await this.params.fileStorage.delete(filePath);
  }

  private resolveContextRecipePath(id: string): string {
    const contextRecipeId = id.trim();
    if (!contextRecipeId) {
      throw new Error("Context recipe ID cannot be empty.");
    }
    return path.join(this.params.rootDirectory, `${contextRecipeId}.json`);
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

