import {
  ContextAssemblyService,
} from "./ContextAssemblyService";
import {
  ContextBudgetingService,
  type IContextBudgetingDecision,
} from "./ContextBudgetingService";
import {
  ContextTrimmingService,
  type IContextTrimmingDecision,
} from "./ContextTrimmingService";
import { ContextInspectionResult } from "./models/ContextInspectionResult";
import {
  ContextProvenanceEntry,
  type ContextInspectionReason,
  type ContextInspectionStage,
  type ContextInspectionStatus,
} from "./models/ContextProvenanceEntry";
import { ContextAssemblyRequest, type IContextAssemblyRequest } from "./models/ContextAssemblyRequest";
import type { IAssembledContextFragment } from "./models/AssembledContext";
import type { IContextBudget } from "./models/ContextBudget";
import type { IContextTrimmingPolicy } from "./models/ContextTrimmingPolicy";

export interface IInspectContextAssemblyRequest {
  readonly assembly?: IContextAssemblyRequest;
  readonly trimmingPolicy?: IContextTrimmingPolicy;
  readonly budget?: IContextBudget;
}

export class InspectContextAssemblyUseCase {
  public constructor(
    private readonly assemblyService: ContextAssemblyService = new ContextAssemblyService(),
    private readonly trimmingService: ContextTrimmingService = new ContextTrimmingService(),
    private readonly budgetingService: ContextBudgetingService = new ContextBudgetingService()
  ) {}

  public execute(request: IInspectContextAssemblyRequest = {}): ContextInspectionResult {
    const assemblyRequest = new ContextAssemblyRequest(request.assembly);
    const separator = request.budget?.separator ?? assemblyRequest.separator;
    const assembly = this.assemblyService.assemble({
      ...assemblyRequest,
      separator,
    });
    const trimming = this.trimmingService.trim(
      assembly.assembledContext.fragments,
      request.trimmingPolicy,
      separator,
    );
    const budgeting = this.budgetingService.enforceBudget(trimmedFragments(trimming), {
      ...request.budget,
      separator,
    });

    const fragmentById = new Map(
      assembly.assembledContext.fragments.map((fragment) => [fragment.id, fragment] as const)
    );
    const trimmedFragmentById = new Map(
      trimming.fragments.map((fragment) => [fragment.id, fragment] as const)
    );
    const finalFragmentById = new Map(
      budgeting.fragments.map((fragment) => [fragment.id, fragment] as const)
    );
    const trimmingDecisionById = new Map(trimming.decisions.map((decision) => [decision.id, decision] as const));
    const budgetingDecisionById = new Map(budgeting.decisions.map((decision) => [decision.id, decision] as const));

    const entries = [
      ...assembly.includedFragments.map((decision) => {
        const originalFragment = fragmentById.get(decision.id);
        const trimmingDecision = trimmingDecisionById.get(decision.id);
        const budgetingDecision = budgetingDecisionById.get(decision.id);
        const trimmedFragment = trimmedFragmentById.get(decision.id) ?? originalFragment;
        const finalFragment = finalFragmentById.get(decision.id);

        const inspectionState = resolveInspectionState(
          decision.reason,
          trimmingDecision,
          budgetingDecision,
        );

        return new ContextProvenanceEntry({
          fragmentId: decision.id,
          kind: decision.kind,
          title: originalFragment?.title,
          assemblyKey: decision.assemblyKey,
          order: originalFragment?.order ?? 0,
          precedence: originalFragment?.precedence ?? 0,
          status: inspectionState.status,
          stage: inspectionState.stage,
          reason: inspectionState.reason,
          visibility: this.trimmingService.getVisibility(originalFragment ?? trimmedFragment ?? finalFragment!),
          matchedSources:
            trimmingDecision?.matchedSources ?? extractMatchedSources(originalFragment ?? trimmedFragment ?? finalFragment),
          provenance: originalFragment?.provenance ?? decision.provenance,
          originalContent: originalFragment?.content ?? "",
          finalContent: finalFragment?.content ?? "",
          originalCharacterCount: originalFragment?.content.length ?? 0,
          finalCharacterCount: finalFragment?.content.length ?? 0,
        });
      }),
      ...assembly.excludedFragments.map((decision) =>
        new ContextProvenanceEntry({
          fragmentId: decision.id,
          kind: decision.kind,
          title: decision.title ?? findDecisionTitle(decision),
          assemblyKey: decision.assemblyKey,
          order: decision.order,
          precedence: decision.precedence,
          status: "excluded",
          stage: "assembly",
          reason: decision.reason,
          visibility: "advanced",
          matchedSources: extractMatchedSources(undefined, decision.provenance),
          provenance: decision.provenance,
          originalContent: decision.content,
          finalContent: "",
          originalCharacterCount: decision.content.length,
          finalCharacterCount: 0,
        })
      ),
    ].sort(compareEntries);

    return new ContextInspectionResult({
      assembly,
      trimming,
      budgeting,
      entries,
      finalFragments: budgeting.fragments,
      assembledPromptText: assembly.assembledContext.promptText,
      finalPromptText: budgeting.promptText,
    });
  }
}

function trimmedFragments(result: { readonly fragments: ReadonlyArray<IAssembledContextFragment> }): ReadonlyArray<IAssembledContextFragment> {
  return result.fragments;
}

function compareEntries(left: ContextProvenanceEntry, right: ContextProvenanceEntry): number {
  return left.order - right.order || left.fragmentId.localeCompare(right.fragmentId);
}

function resolveInspectionState(
  assemblyReason: ContextInspectionReason,
  trimmingDecision?: IContextTrimmingDecision,
  budgetingDecision?: IContextBudgetingDecision,
): {
  readonly status: ContextInspectionStatus;
  readonly stage: ContextInspectionStage;
  readonly reason: ContextInspectionReason;
} {
  if (assemblyReason !== "included") {
    return { status: "excluded", stage: "assembly", reason: assemblyReason };
  }

  if (trimmingDecision && trimmingDecision.action !== "included") {
    return { status: "excluded", stage: "trimming", reason: trimmingDecision.action };
  }

  if (budgetingDecision?.action === "trimmed-to-fit") {
    return { status: "trimmed", stage: "budget", reason: budgetingDecision.action };
  }

  if (budgetingDecision?.action === "excluded-over-budget") {
    return { status: "excluded", stage: "budget", reason: budgetingDecision.action };
  }

  return { status: "included", stage: "budget", reason: budgetingDecision?.action ?? "included" };
}

function extractMatchedSources(
  fragment?: IAssembledContextFragment,
  provenance?: ReadonlyArray<IAssembledContextFragment["provenance"][number]>,
): ReadonlyArray<string> {
  const matched = new Set<string>();

  const add = (value: unknown): void => {
    if (typeof value !== "string") {
      return;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized) {
      matched.add(normalized);
    }
  };

  add(fragment?.metadata?.source);
  add(fragment?.metadata?.sourceId);
  add(fragment?.metadata?.sourceType);
  add(fragment?.metadata?.packageId);
  add(fragment?.metadata?.packageAlias);
  add(fragment?.metadata?.packageName);
  add(fragment?.metadata?.dynamicSourceId);
  add(fragment?.metadata?.dynamicSourceType);
  add(fragment?.metadata?.dynamicSourceLabel);

  for (const item of provenance ?? fragment?.provenance ?? []) {
    add(item.sourceType);
    add(item.packageId);
    add(item.packageAlias);
    add(item.packageName);
    add(item.dynamicSourceId);
    add(item.dynamicSourceType);
    add(item.dynamicSourceLabel);
  }

  return Object.freeze([...matched].sort());
}

function findDecisionTitle(decision: { readonly provenance: ReadonlyArray<{ readonly fragmentTitle?: string }> }): string | undefined {
  return decision.provenance.find((entry) => typeof entry.fragmentTitle === "string")?.fragmentTitle?.trim() || undefined;
}
