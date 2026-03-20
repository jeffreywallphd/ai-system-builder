import {
  ContextRecipe,
  type IContextRecipeAuditInfo,
  type IContextRecipeBudgetingDefaults,
  type IContextRecipeDynamicSourcePreferences,
  type IContextRecipeGuidance,
  type IContextRecipeToolUseGuidance,
} from "./models/ContextRecipe";
import type { IContextPackageReference } from "./models/ContextPackageReference";
import type { IContextRecipeRepository } from "../ports/interfaces/IContextRecipeRepository";

export interface ICreateContextRecipeRequest {
  readonly id?: string;
  readonly name: string;
  readonly description?: string;
  readonly version?: string;
  readonly tags?: ReadonlyArray<string>;
  readonly packageReferences?: ReadonlyArray<IContextPackageReference>;
  readonly dynamicSourcePreferences?: IContextRecipeDynamicSourcePreferences;
  readonly budgetingDefaults?: IContextRecipeBudgetingDefaults;
  readonly guidance?: IContextRecipeGuidance;
  readonly toolUseGuidance?: IContextRecipeToolUseGuidance;
  readonly audit?: IContextRecipeAuditInfo;
}

export interface ICreateContextRecipeResult {
  readonly contextRecipe: ContextRecipe;
  readonly created: boolean;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultIdFactory(request: ICreateContextRecipeRequest): string {
  const slug = slugify(request.id?.trim() || request.name);
  return slug || "context-recipe";
}

export class CreateContextRecipeUseCase {
  private readonly contextRecipeRepository: IContextRecipeRepository;
  private readonly createId: (request: ICreateContextRecipeRequest) => string;

  constructor(params: {
    contextRecipeRepository: IContextRecipeRepository;
    createId?: (request: ICreateContextRecipeRequest) => string;
  }) {
    this.contextRecipeRepository = params.contextRecipeRepository;
    this.createId = params.createId ?? defaultIdFactory;
  }

  public async execute(
    request: ICreateContextRecipeRequest
  ): Promise<ICreateContextRecipeResult> {
    const contextRecipe = new ContextRecipe({
      id: request.id?.trim() || this.createId(request),
      name: request.name,
      description: request.description,
      version: request.version,
      tags: request.tags,
      packageReferences: request.packageReferences,
      dynamicSourcePreferences: request.dynamicSourcePreferences,
      budgetingDefaults: request.budgetingDefaults,
      guidance: request.guidance,
      toolUseGuidance: request.toolUseGuidance,
      audit: request.audit ?? { createdAt: new Date(), updatedAt: new Date() },
    });

    const created = !(await this.contextRecipeRepository.exists(contextRecipe.id));
    const savedContextRecipe = await this.contextRecipeRepository.save(contextRecipe);

    return Object.freeze({
      contextRecipe: savedContextRecipe,
      created,
    });
  }
}
