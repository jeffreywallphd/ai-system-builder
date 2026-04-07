import { ContextRecipe } from "./models/ContextRecipe";
import type { IContextRecipeRepository } from "../ports/interfaces/IContextRecipeRepository";

export interface ILoadContextRecipeRequest {
  readonly contextRecipeId: string;
  readonly throwIfNotFound?: boolean;
}

export interface ILoadContextRecipeResult {
  readonly contextRecipe?: ContextRecipe;
}

export class LoadContextRecipeUseCase {
  constructor(private readonly contextRecipeRepository: IContextRecipeRepository) {}

  public async execute(
    request: ILoadContextRecipeRequest
  ): Promise<ILoadContextRecipeResult> {
    const contextRecipeId = request.contextRecipeId.trim();

    if (!contextRecipeId) {
      throw new Error("LoadContextRecipeUseCase requires a non-empty contextRecipeId.");
    }

    const contextRecipe = await this.contextRecipeRepository.load(contextRecipeId);

    if (!contextRecipe) {
      if (request.throwIfNotFound ?? true) {
        throw new Error(`Context recipe '${contextRecipeId}' was not found.`);
      }

      return Object.freeze({ contextRecipe: undefined });
    }

    return Object.freeze({
      contextRecipe: ContextRecipe.from(contextRecipe),
    });
  }
}
