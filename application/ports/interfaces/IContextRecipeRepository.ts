import type { ContextRecipe } from "../../context/models/ContextRecipe";

export interface IContextRecipeListCriteria {
  readonly query?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly limit?: number;
}

export interface IContextRecipeSummary {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags: ReadonlyArray<string>;
  readonly packageReferenceCount: number;
  readonly updatedAt?: Date;
}

export interface IContextRecipeRepository {
  save(contextRecipe: ContextRecipe): Promise<ContextRecipe>;
  load(id: string): Promise<ContextRecipe | undefined>;
  list(criteria?: IContextRecipeListCriteria): Promise<ReadonlyArray<IContextRecipeSummary>>;
  exists(id: string): Promise<boolean>;
  delete(id: string): Promise<void>;
}
