import { ContextRecipe } from "../../../application/context/models/ContextRecipe";
import type {
  IContextRecipeListCriteria,
  IContextRecipeRepository,
  IContextRecipeSummary,
} from "../../../application/ports/interfaces/IContextRecipeRepository";

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

function matchesCriteria(contextRecipe: ContextRecipe, criteria?: IContextRecipeListCriteria): boolean {
  if (!criteria) {
    return true;
  }

  if (criteria.query) {
    const query = normalize(criteria.query);
    const haystack = [
      contextRecipe.id,
      contextRecipe.name,
      contextRecipe.description,
      contextRecipe.version,
      ...contextRecipe.tags,
    ]
      .filter(Boolean)
      .map((value) => normalize(String(value)));

    if (!haystack.some((value) => value.includes(query))) {
      return false;
    }
  }

  return includesAny(contextRecipe.tags, criteria.tags);
}

function toSummary(contextRecipe: ContextRecipe): IContextRecipeSummary {
  return Object.freeze({
    id: contextRecipe.id,
    name: contextRecipe.name,
    description: contextRecipe.description,
    version: contextRecipe.version,
    tags: contextRecipe.tags,
    packageReferenceCount: contextRecipe.packageReferences.length,
    updatedAt: contextRecipe.audit?.updatedAt,
  });
}

export class InMemoryContextRecipeRepository implements IContextRecipeRepository {
  private readonly contextRecipes = new Map<string, ContextRecipe>();

  constructor(initialRecipes: ReadonlyArray<ContextRecipe> = []) {
    for (const contextRecipe of initialRecipes) {
      this.contextRecipes.set(contextRecipe.id, ContextRecipe.from(contextRecipe));
    }
  }

  public async save(contextRecipe: ContextRecipe): Promise<ContextRecipe> {
    const saved = ContextRecipe.from(contextRecipe);
    this.contextRecipes.set(saved.id, saved);
    return saved;
  }

  public async load(id: string): Promise<ContextRecipe | undefined> {
    const recipe = this.contextRecipes.get(id.trim());
    return recipe ? ContextRecipe.from(recipe) : undefined;
  }

  public async list(
    criteria?: IContextRecipeListCriteria
  ): Promise<ReadonlyArray<IContextRecipeSummary>> {
    const contextRecipes = [...this.contextRecipes.values()]
      .filter((contextRecipe) => matchesCriteria(contextRecipe, criteria))
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(toSummary);

    return Object.freeze(
      criteria?.limit && criteria.limit > 0 ? contextRecipes.slice(0, criteria.limit) : contextRecipes
    );
  }

  public async exists(id: string): Promise<boolean> {
    return this.contextRecipes.has(id.trim());
  }

  public async delete(id: string): Promise<void> {
    this.contextRecipes.delete(id.trim());
  }
}
