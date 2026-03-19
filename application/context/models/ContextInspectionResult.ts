import type { IAssembledContextFragment } from "./AssembledContext";
import { ContextAssemblyResult } from "./ContextAssemblyResult";
import type { IContextBudgetingResult } from "../ContextBudgetingService";
import type { IContextTrimmingResult } from "../ContextTrimmingService";
import {
  ContextProvenanceEntry,
  type IContextProvenanceEntry,
} from "./ContextProvenanceEntry";

export interface IContextInspectionResult {
  readonly assembly: ContextAssemblyResult;
  readonly trimming: IContextTrimmingResult;
  readonly budgeting: IContextBudgetingResult;
  readonly entries: ReadonlyArray<ContextProvenanceEntry>;
  readonly finalFragments: ReadonlyArray<IAssembledContextFragment>;
  readonly assembledPromptText: string;
  readonly finalPromptText: string;
}

function freezeFragments(
  fragments?: ReadonlyArray<IAssembledContextFragment>
): ReadonlyArray<IAssembledContextFragment> {
  return Object.freeze(
    (fragments ?? []).map((fragment) =>
      Object.freeze({
        ...fragment,
        provenance: Object.freeze([...(fragment.provenance ?? [])]),
        metadata: fragment.metadata ? Object.freeze({ ...fragment.metadata }) : undefined,
      })
    )
  );
}

function freezeTrimmingResult(result: IContextTrimmingResult): IContextTrimmingResult {
  return Object.freeze({
    ...result,
    fragments: freezeFragments(result.fragments),
    decisions: Object.freeze(
      result.decisions.map((decision) =>
        Object.freeze({
          ...decision,
          matchedSources: Object.freeze([...(decision.matchedSources ?? [])]),
        })
      )
    ),
  });
}

function freezeBudgetingResult(result: IContextBudgetingResult): IContextBudgetingResult {
  return Object.freeze({
    ...result,
    fragments: freezeFragments(result.fragments),
    decisions: Object.freeze(
      result.decisions.map((decision) =>
        Object.freeze({
          ...decision,
        })
      )
    ),
  });
}

function freezeEntries(
  entries?: ReadonlyArray<IContextProvenanceEntry>
): ReadonlyArray<ContextProvenanceEntry> {
  return Object.freeze((entries ?? []).map((entry) => new ContextProvenanceEntry(entry)));
}

export class ContextInspectionResult implements IContextInspectionResult {
  public readonly assembly: ContextAssemblyResult;
  public readonly trimming: IContextTrimmingResult;
  public readonly budgeting: IContextBudgetingResult;
  public readonly entries: ReadonlyArray<ContextProvenanceEntry>;
  public readonly finalFragments: ReadonlyArray<IAssembledContextFragment>;
  public readonly assembledPromptText: string;
  public readonly finalPromptText: string;

  constructor(params: IContextInspectionResult) {
    this.assembly = params.assembly;
    this.trimming = freezeTrimmingResult(params.trimming);
    this.budgeting = freezeBudgetingResult(params.budgeting);
    this.entries = freezeEntries(params.entries);
    this.finalFragments = freezeFragments(params.finalFragments);
    this.assembledPromptText = params.assembledPromptText.trim();
    this.finalPromptText = params.finalPromptText;
  }
}
