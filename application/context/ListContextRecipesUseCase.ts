import type {
  IContextRecipeListCriteria,
  IContextRecipeRepository,
  IContextRecipeSummary,
} from "../ports/interfaces/IContextRecipeRepository";

export interface IListContextRecipesRequest {
  readonly criteria?: IContextRecipeListCriteria;
}

export interface IListContextRecipesResult {
  readonly contextRecipes: ReadonlyArray<IContextRecipeSummary>;
}

export class ListContextRecipesUseCase {
  constructor(private readonly contextRecipeRepository: IContextRecipeRepository) {}

  public async execute(
    request: IListContextRecipesRequest = {}
  ): Promise<IListContextRecipesResult> {
    const contextRecipes = await this.contextRecipeRepository.list(request.criteria);

    return Object.freeze({
      contextRecipes: Object.freeze([...contextRecipes]),
    });
  }
}
