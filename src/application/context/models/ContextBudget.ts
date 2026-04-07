export interface IContextBudget {
  readonly maxCharacters?: number;
  readonly maxTokens?: number;
  readonly reservedCharacters?: number;
  readonly reservedTokens?: number;
  readonly approximateCharactersPerToken?: number;
  readonly trimPartialFragments?: boolean;
  readonly separator?: string;
}

function normalizeOptionalPositiveInteger(value: number | undefined, fieldName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`ContextBudget.${fieldName} must be a finite positive number or zero.`);
  }

  return Math.floor(value);
}

export class ContextBudget implements IContextBudget {
  public readonly maxCharacters?: number;
  public readonly maxTokens?: number;
  public readonly reservedCharacters: number;
  public readonly reservedTokens: number;
  public readonly approximateCharactersPerToken: number;
  public readonly trimPartialFragments: boolean;
  public readonly separator: string;

  constructor(params: IContextBudget = {}) {
    this.maxCharacters = normalizeOptionalPositiveInteger(params.maxCharacters, "maxCharacters");
    this.maxTokens = normalizeOptionalPositiveInteger(params.maxTokens, "maxTokens");
    this.reservedCharacters = normalizeOptionalPositiveInteger(params.reservedCharacters, "reservedCharacters") ?? 0;
    this.reservedTokens = normalizeOptionalPositiveInteger(params.reservedTokens, "reservedTokens") ?? 0;
    this.approximateCharactersPerToken =
      normalizeOptionalPositiveInteger(params.approximateCharactersPerToken, "approximateCharactersPerToken") ?? 4;
    this.trimPartialFragments = params.trimPartialFragments ?? true;
    this.separator = params.separator ?? "\n\n";
  }

  public get characterLimit(): number | undefined {
    if (this.maxCharacters === undefined) {
      return undefined;
    }

    return Math.max(0, this.maxCharacters - this.reservedCharacters);
  }

  public get tokenLimit(): number | undefined {
    if (this.maxTokens === undefined) {
      return undefined;
    }

    return Math.max(0, this.maxTokens - this.reservedTokens);
  }
}
