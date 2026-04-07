export interface IContextRecipeSelection {
  readonly recipeId: string;
  readonly alias?: string;
  readonly isEnabled?: boolean;
  readonly surfaceInTool?: boolean;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`ContextRecipeSelection.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export class ContextRecipeSelection implements IContextRecipeSelection {
  public readonly recipeId: string;
  public readonly alias?: string;
  public readonly isEnabled?: boolean;
  public readonly surfaceInTool?: boolean;

  constructor(params: IContextRecipeSelection) {
    this.recipeId = normalizeRequired(params.recipeId, "recipeId");
    this.alias = normalizeOptional(params.alias);
    this.isEnabled = params.isEnabled ?? true;
    this.surfaceInTool = params.surfaceInTool ?? true;
  }

  public static from(selection: IContextRecipeSelection): ContextRecipeSelection {
    return new ContextRecipeSelection(selection);
  }
}
