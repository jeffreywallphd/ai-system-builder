import { AssembledContext, type IContextFragmentProvenance } from "./AssembledContext";
import type { ContextFragmentKind } from "./ContextFragment";

export interface IContextAssemblyDecision {
  readonly id: string;
  readonly kind: ContextFragmentKind;
  readonly title?: string;
  readonly content: string;
  readonly order: number;
  readonly precedence: number;
  readonly assemblyKey: string;
  readonly reason:
    | "included"
    | "excluded-by-kind"
    | "excluded-by-fragment-id"
    | "excluded-by-package-filter"
    | "shadowed-by-precedence";
  readonly provenance: ReadonlyArray<IContextFragmentProvenance>;
}

export interface IContextAssemblyResult {
  readonly assembledContext: AssembledContext;
  readonly includedFragments: ReadonlyArray<IContextAssemblyDecision>;
  readonly excludedFragments: ReadonlyArray<IContextAssemblyDecision>;
}

function freezeDecisions(
  decisions?: ReadonlyArray<IContextAssemblyDecision>
): ReadonlyArray<IContextAssemblyDecision> {
  return Object.freeze(
    (decisions ?? []).map((decision) =>
      Object.freeze({
        ...decision,
        provenance: Object.freeze([...(decision.provenance ?? [])]),
      })
    )
  );
}

export class ContextAssemblyResult implements IContextAssemblyResult {
  public readonly assembledContext: AssembledContext;
  public readonly includedFragments: ReadonlyArray<IContextAssemblyDecision>;
  public readonly excludedFragments: ReadonlyArray<IContextAssemblyDecision>;

  constructor(params: IContextAssemblyResult) {
    this.assembledContext = params.assembledContext;
    this.includedFragments = freezeDecisions(params.includedFragments);
    this.excludedFragments = freezeDecisions(params.excludedFragments);
  }
}
