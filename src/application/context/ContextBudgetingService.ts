import type { IAssembledContextFragment } from "./models/AssembledContext";
import { ContextBudget, type IContextBudget } from "./models/ContextBudget";

export interface IContextBudgetingDecision {
  readonly id: string;
  readonly action: "included" | "trimmed-to-fit" | "excluded-over-budget";
  readonly originalCharacterCount: number;
  readonly includedCharacterCount: number;
  readonly originalTokenCount: number;
  readonly includedTokenCount: number;
}

export interface IContextBudgetingResult {
  readonly fragments: ReadonlyArray<IAssembledContextFragment>;
  readonly promptText: string;
  readonly totalCharacterCount: number;
  readonly includedCharacterCount: number;
  readonly totalTokenCount: number;
  readonly includedTokenCount: number;
  readonly budgetCharacterLimit?: number;
  readonly budgetTokenLimit?: number;
  readonly wasTrimmed: boolean;
  readonly decisions: ReadonlyArray<IContextBudgetingDecision>;
}

function estimateTokens(text: string, approximateCharactersPerToken: number): number {
  if (!text) {
    return 0;
  }

  return Math.ceil(text.length / Math.max(1, approximateCharactersPerToken));
}

function cloneFragment(
  fragment: IAssembledContextFragment,
  content: string
): IAssembledContextFragment {
  return Object.freeze({
    ...fragment,
    content,
    metadata: fragment.metadata ? Object.freeze({ ...fragment.metadata }) : undefined,
    provenance: Object.freeze([...(fragment.provenance ?? [])]),
  });
}

function freezeDecision(decision: IContextBudgetingDecision): IContextBudgetingDecision {
  return Object.freeze({ ...decision });
}

function trimContentToFit(
  content: string,
  remainingCharacters: number | undefined,
  remainingTokens: number | undefined,
  approximateCharactersPerToken: number
): string {
  let characterLimit = remainingCharacters ?? content.length;

  if (remainingTokens !== undefined) {
    characterLimit = Math.min(characterLimit, remainingTokens * approximateCharactersPerToken);
  }

  if (characterLimit <= 0) {
    return "";
  }

  let trimmed = content.slice(0, characterLimit);
  if (trimmed.length < content.length && trimmed.length > 1) {
    trimmed = `${trimmed.slice(0, Math.max(0, trimmed.length - 1)).trimEnd()}…`;
  }

  while (
    trimmed &&
    ((remainingCharacters !== undefined && trimmed.length > remainingCharacters) ||
      (remainingTokens !== undefined && estimateTokens(trimmed, approximateCharactersPerToken) > remainingTokens))
  ) {
    trimmed = trimmed.slice(0, Math.max(0, trimmed.length - 1)).trimEnd();
  }

  return trimmed;
}

export class ContextBudgetingService {
  public estimateTokens(text: string, budget: IContextBudget = {}): number {
    return estimateTokens(text, new ContextBudget(budget).approximateCharactersPerToken);
  }

  public enforceBudget(
    fragments: ReadonlyArray<IAssembledContextFragment>,
    budgetInput: IContextBudget = {}
  ): IContextBudgetingResult {
    const budget = new ContextBudget(budgetInput);
    const included: IAssembledContextFragment[] = [];
    const decisions: IContextBudgetingDecision[] = [];
    const separator = budget.separator;
    const separatorCharacters = separator.length;
    const separatorTokens = estimateTokens(separator, budget.approximateCharactersPerToken);
    const budgetCharacterLimit = budget.characterLimit;
    const budgetTokenLimit = budget.tokenLimit;
    const totalCharacterCount = fragments.reduce(
      (sum, fragment, index) => sum + fragment.content.length + (index > 0 ? separatorCharacters : 0),
      0
    );
    const totalTokenCount = estimateTokens(
      fragments.map((fragment) => fragment.content).join(separator),
      budget.approximateCharactersPerToken
    );

    let includedCharacterCount = 0;
    let includedTokenCount = 0;
    let budgetExceeded = false;

    for (const fragment of fragments) {
      const separatorCharacterCost = included.length > 0 ? separatorCharacters : 0;
      const separatorTokenCost = included.length > 0 ? separatorTokens : 0;
      const fragmentCharacters = fragment.content.length;
      const fragmentTokens = estimateTokens(fragment.content, budget.approximateCharactersPerToken);
      const nextCharacterCount = includedCharacterCount + separatorCharacterCost + fragmentCharacters;
      const nextTokenCount = includedTokenCount + separatorTokenCost + fragmentTokens;
      const fitsCharacters = budgetCharacterLimit === undefined || nextCharacterCount <= budgetCharacterLimit;
      const fitsTokens = budgetTokenLimit === undefined || nextTokenCount <= budgetTokenLimit;

      if (!budgetExceeded && fitsCharacters && fitsTokens) {
        included.push(fragment);
        includedCharacterCount = nextCharacterCount;
        includedTokenCount = nextTokenCount;
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "included",
            originalCharacterCount: fragmentCharacters,
            includedCharacterCount: fragmentCharacters,
            originalTokenCount: fragmentTokens,
            includedTokenCount: fragmentTokens,
          })
        );
        continue;
      }

      budgetExceeded = true;

      const remainingCharacters =
        budgetCharacterLimit === undefined
          ? undefined
          : Math.max(0, budgetCharacterLimit - includedCharacterCount - separatorCharacterCost);
      const remainingTokens =
        budgetTokenLimit === undefined
          ? undefined
          : Math.max(0, budgetTokenLimit - includedTokenCount - separatorTokenCost);
      const trimmedContent = budget.trimPartialFragments
        ? trimContentToFit(fragment.content, remainingCharacters, remainingTokens, budget.approximateCharactersPerToken)
        : "";

      if (trimmedContent) {
        const trimmedCharacters = trimmedContent.length;
        const trimmedTokens = estimateTokens(trimmedContent, budget.approximateCharactersPerToken);
        included.push(cloneFragment(fragment, trimmedContent));
        includedCharacterCount += separatorCharacterCost + trimmedCharacters;
        includedTokenCount += separatorTokenCost + trimmedTokens;
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "trimmed-to-fit",
            originalCharacterCount: fragmentCharacters,
            includedCharacterCount: trimmedCharacters,
            originalTokenCount: fragmentTokens,
            includedTokenCount: trimmedTokens,
          })
        );
      } else {
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "excluded-over-budget",
            originalCharacterCount: fragmentCharacters,
            includedCharacterCount: 0,
            originalTokenCount: fragmentTokens,
            includedTokenCount: 0,
          })
        );
      }

      for (const remainingFragment of fragments.slice(fragments.indexOf(fragment) + 1)) {
        decisions.push(
          freezeDecision({
            id: remainingFragment.id,
            action: "excluded-over-budget",
            originalCharacterCount: remainingFragment.content.length,
            includedCharacterCount: 0,
            originalTokenCount: estimateTokens(remainingFragment.content, budget.approximateCharactersPerToken),
            includedTokenCount: 0,
          })
        );
      }
      break;
    }

    return Object.freeze({
      fragments: Object.freeze(included),
      promptText: included.map((fragment) => fragment.content).join(separator),
      totalCharacterCount,
      includedCharacterCount,
      totalTokenCount,
      includedTokenCount,
      budgetCharacterLimit,
      budgetTokenLimit,
      wasTrimmed: included.length !== fragments.length || includedCharacterCount !== totalCharacterCount,
      decisions: Object.freeze(decisions),
    });
  }
}
