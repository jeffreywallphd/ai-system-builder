import type { IAssembledContextFragment } from "./models/AssembledContext";
import { ContextTrimmingPolicy, type IContextTrimmingPolicy } from "./models/ContextTrimmingPolicy";

export interface IContextTrimmingDecision {
  readonly id: string;
  readonly action: "included" | "excluded-by-visibility" | "excluded-by-kind" | "excluded-by-source";
  readonly visibility: "basic" | "advanced";
  readonly matchedSources: ReadonlyArray<string>;
}

export interface IContextTrimmingResult {
  readonly fragments: ReadonlyArray<IAssembledContextFragment>;
  readonly promptText: string;
  readonly decisions: ReadonlyArray<IContextTrimmingDecision>;
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveVisibility(fragment: IAssembledContextFragment): "basic" | "advanced" {
  const visibilityValue = fragment.metadata?.visibility;
  if (visibilityValue === "advanced") {
    return "advanced";
  }

  if (visibilityValue === "basic") {
    return "basic";
  }

  if (fragment.metadata?.isAdvanced === true) {
    return "advanced";
  }

  return "basic";
}

function extractFragmentSources(fragment: IAssembledContextFragment): ReadonlyArray<string> {
  const sources = new Set<string>();
  const metadata = fragment.metadata;

  const add = (value: unknown): void => {
    if (typeof value !== "string") {
      return;
    }

    const normalized = value.trim().toLowerCase();
    if (normalized) {
      sources.add(normalized);
    }
  };

  add(metadata?.source);
  add(metadata?.sourceId);
  add(metadata?.sourceType);
  add(metadata?.packageId);
  add(metadata?.packageAlias);
  add(metadata?.packageName);

  for (const provenance of fragment.provenance) {
    add(provenance.sourceType);
    add(provenance.packageId);
    add(provenance.packageAlias);
    add(provenance.packageName);
  }

  return Object.freeze([...sources].sort());
}

function freezeDecision(decision: IContextTrimmingDecision): IContextTrimmingDecision {
  return Object.freeze({
    ...decision,
    matchedSources: Object.freeze([...(decision.matchedSources ?? [])]),
  });
}

export class ContextTrimmingService {
  public trim(
    fragments: ReadonlyArray<IAssembledContextFragment>,
    policyInput: IContextTrimmingPolicy = {},
    separator = "\n\n"
  ): IContextTrimmingResult {
    const policy = new ContextTrimmingPolicy(policyInput);
    const kept: IAssembledContextFragment[] = [];
    const decisions: IContextTrimmingDecision[] = [];

    for (const fragment of fragments) {
      const visibility = resolveVisibility(fragment);
      const sources = extractFragmentSources(fragment);

      if (policy.visibilityMode === "basic" && visibility === "advanced") {
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "excluded-by-visibility",
            visibility,
            matchedSources: sources,
          })
        );
        continue;
      }

      if (policy.includeKinds.length > 0 && !policy.includeKinds.includes(fragment.kind)) {
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "excluded-by-kind",
            visibility,
            matchedSources: sources,
          })
        );
        continue;
      }

      if (policy.excludeKinds.includes(fragment.kind)) {
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "excluded-by-kind",
            visibility,
            matchedSources: sources,
          })
        );
        continue;
      }

      if (policy.includeSources.length > 0 && !policy.includeSources.some((source) => sources.includes(source))) {
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "excluded-by-source",
            visibility,
            matchedSources: sources,
          })
        );
        continue;
      }

      if (policy.excludeSources.some((source) => sources.includes(source))) {
        decisions.push(
          freezeDecision({
            id: fragment.id,
            action: "excluded-by-source",
            visibility,
            matchedSources: sources,
          })
        );
        continue;
      }

      kept.push(fragment);
      decisions.push(
        freezeDecision({
          id: fragment.id,
          action: "included",
          visibility,
          matchedSources: sources,
        })
      );
    }

    return Object.freeze({
      fragments: Object.freeze([...kept]),
      promptText: kept.map((fragment) => fragment.content).join(separator),
      decisions: Object.freeze(decisions),
    });
  }

  public getVisibility(fragment: IAssembledContextFragment): "basic" | "advanced" {
    return resolveVisibility(fragment);
  }

  public getPrimarySource(fragment: IAssembledContextFragment): string | undefined {
    return normalizeOptionalString(extractFragmentSources(fragment)[0]);
  }
}
