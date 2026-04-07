import type { IContextFragmentProvenance } from "./AssembledContext";
import type { ContextFragmentKind } from "./ContextFragment";
import type { ContextVisibilityMode } from "./ContextVisibilityMode";
import type { IContextAssemblyDecision } from "./ContextAssemblyResult";
import type { IContextTrimmingDecision } from "../ContextTrimmingService";
import type { IContextBudgetingDecision } from "../ContextBudgetingService";

export type ContextInspectionStage = "assembly" | "trimming" | "budget";

export type ContextInspectionStatus = "included" | "trimmed" | "excluded";

export type ContextInspectionReason =
  | IContextAssemblyDecision["reason"]
  | IContextTrimmingDecision["action"]
  | IContextBudgetingDecision["action"];

export interface IContextProvenanceEntry {
  readonly fragmentId: string;
  readonly kind: ContextFragmentKind;
  readonly title?: string;
  readonly assemblyKey: string;
  readonly order: number;
  readonly precedence: number;
  readonly status: ContextInspectionStatus;
  readonly stage: ContextInspectionStage;
  readonly reason: ContextInspectionReason;
  readonly visibility: ContextVisibilityMode;
  readonly matchedSources: ReadonlyArray<string>;
  readonly provenance: ReadonlyArray<IContextFragmentProvenance>;
  readonly originalContent: string;
  readonly finalContent: string;
  readonly originalCharacterCount: number;
  readonly finalCharacterCount: number;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`ContextProvenanceEntry.${fieldName} cannot be empty.`);
  }

  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function freezeStrings(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])]);
}

function freezeProvenance(
  values?: ReadonlyArray<IContextFragmentProvenance>
): ReadonlyArray<IContextFragmentProvenance> {
  return Object.freeze(
    (values ?? []).map((entry) =>
      Object.freeze({
        ...entry,
        packageId: normalizeOptional(entry.packageId),
        packageName: normalizeOptional(entry.packageName),
        packageAlias: normalizeOptional(entry.packageAlias),
        fragmentId: normalizeRequired(entry.fragmentId, "provenance.fragmentId"),
        fragmentTitle: normalizeOptional(entry.fragmentTitle),
      })
    )
  );
}

export class ContextProvenanceEntry implements IContextProvenanceEntry {
  public readonly fragmentId: string;
  public readonly kind: ContextFragmentKind;
  public readonly title?: string;
  public readonly assemblyKey: string;
  public readonly order: number;
  public readonly precedence: number;
  public readonly status: ContextInspectionStatus;
  public readonly stage: ContextInspectionStage;
  public readonly reason: ContextInspectionReason;
  public readonly visibility: ContextVisibilityMode;
  public readonly matchedSources: ReadonlyArray<string>;
  public readonly provenance: ReadonlyArray<IContextFragmentProvenance>;
  public readonly originalContent: string;
  public readonly finalContent: string;
  public readonly originalCharacterCount: number;
  public readonly finalCharacterCount: number;

  constructor(params: IContextProvenanceEntry) {
    this.fragmentId = normalizeRequired(params.fragmentId, "fragmentId");
    this.kind = params.kind;
    this.title = normalizeOptional(params.title);
    this.assemblyKey = normalizeRequired(params.assemblyKey, "assemblyKey");
    this.order = params.order;
    this.precedence = params.precedence;
    this.status = params.status;
    this.stage = params.stage;
    this.reason = params.reason;
    this.visibility = params.visibility;
    this.matchedSources = freezeStrings(params.matchedSources);
    this.provenance = freezeProvenance(params.provenance);
    this.originalContent = params.originalContent;
    this.finalContent = params.finalContent;
    this.originalCharacterCount = Math.max(0, Math.floor(params.originalCharacterCount));
    this.finalCharacterCount = Math.max(0, Math.floor(params.finalCharacterCount));
  }
}
