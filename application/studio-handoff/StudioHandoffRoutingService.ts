import {
  createStudioHandoffContract,
  StudioHandoffAssetRoles,
  StudioHandoffIntentKinds,
  type MultiAssetStudioHandoffContract,
  type StudioHandoffContract,
  type StudioHandoffIntent,
  type StudioHandoffSource,
  type StudioHandoffTarget,
  type TargetStudioInputContract,
} from "../../domain/studio-handoff/StudioHandoffContract";
import { createStudioHandoffContext, type StudioHandoffContext } from "../../domain/studio-handoff/StudioHandoffContext";
import type { StudioHandoffCompatibilityDecision, StudioHandoffCompatibilityValidator } from "./StudioHandoffCompatibilityValidator";
import type { StudioCapabilityDescriptor, StudioCapabilityQueryService } from "./StudioCapabilityRegistry";
import type { StudioProducedOutput } from "./StudioOutputAdapter";

export const StudioHandoffRoutingReasonCodes = Object.freeze({
  noCapabilitiesRegistered: "no-capabilities-registered",
  sourceStudioExcluded: "source-studio-excluded",
  targetCapabilityRejected: "target-capability-rejected",
  contractEvaluated: "contract-evaluated",
  groupedMultiAssetUnsupported: "grouped-multi-asset-unsupported",
  groupedMultiAssetSupported: "grouped-multi-asset-supported",
  systemStudioPreferredForComposition: "system-studio-preferred-for-composition",
  intentPriorityBoost: "intent-priority-boost",
  compatible: "compatible",
  incompatible: "incompatible",
  selectedPreferredTarget: "selected-preferred-target",
});

export type StudioHandoffRoutingReasonCode =
  typeof StudioHandoffRoutingReasonCodes[keyof typeof StudioHandoffRoutingReasonCodes];

export interface StudioHandoffRoutingReason {
  readonly code: StudioHandoffRoutingReasonCode;
  readonly message: string;
  readonly studioType?: string;
  readonly contractId?: string;
}

export interface StudioHandoffRouteCandidate {
  readonly studioType: string;
  readonly studioId: string;
  readonly registrationKind?: "atomic" | "composite" | "system";
  readonly compatible: boolean;
  readonly score: number;
  readonly matchedContractId?: string;
  readonly compatibility: StudioHandoffCompatibilityDecision;
  readonly reasons: ReadonlyArray<StudioHandoffRoutingReason>;
}

export interface StudioHandoffRouteDecision {
  readonly preferred?: StudioHandoffRouteCandidate;
  readonly candidates: ReadonlyArray<StudioHandoffRouteCandidate>;
  readonly compatibleCandidates: ReadonlyArray<StudioHandoffRouteCandidate>;
  readonly alternateCandidates: ReadonlyArray<StudioHandoffRouteCandidate>;
  readonly reasons: ReadonlyArray<StudioHandoffRoutingReason>;
  readonly deterministicSignature: string;
}

export interface StudioHandoffRoutingRequest {
  readonly handoffId?: string;
  readonly sourceOutput: StudioProducedOutput;
  readonly source?: StudioHandoffSource;
  readonly intent?: StudioHandoffIntent;
  readonly context?: StudioHandoffContext;
  readonly multiAsset?: MultiAssetStudioHandoffContract;
  readonly previousDecision?: StudioHandoffRouteDecision;
  readonly existingHandoff?: StudioHandoffContract;
}

export interface StudioHandoffRoutingRuleContext {
  readonly request: StudioHandoffRoutingRequest;
  readonly descriptor: StudioCapabilityDescriptor;
  readonly selectedContract: TargetStudioInputContract;
  readonly compatibility: StudioHandoffCompatibilityDecision;
}

export interface StudioHandoffRoutingRuleResult {
  readonly scoreDelta?: number;
  readonly reasons?: ReadonlyArray<StudioHandoffRoutingReason>;
}

export interface StudioHandoffRoutingRule {
  readonly id: string;
  evaluate(input: StudioHandoffRoutingRuleContext): StudioHandoffRoutingRuleResult;
}

function freezeReason(input: StudioHandoffRoutingReason): StudioHandoffRoutingReason {
  return Object.freeze({
    code: input.code,
    message: input.message,
    studioType: input.studioType,
    contractId: input.contractId,
  });
}

function stableSortCandidates(candidates: ReadonlyArray<StudioHandoffRouteCandidate>): ReadonlyArray<StudioHandoffRouteCandidate> {
  return Object.freeze([...candidates].sort((left, right) => {
    if (left.compatible !== right.compatible) {
      return Number(right.compatible) - Number(left.compatible);
    }
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.studioType !== right.studioType) {
      return left.studioType.localeCompare(right.studioType);
    }
    return (left.matchedContractId ?? "").localeCompare(right.matchedContractId ?? "");
  }));
}

function createCompatibilityRuleReason(input: {
  readonly compatible: boolean;
  readonly studioType: string;
  readonly contractId: string;
}): StudioHandoffRoutingReason {
  return freezeReason({
    code: input.compatible ? StudioHandoffRoutingReasonCodes.compatible : StudioHandoffRoutingReasonCodes.incompatible,
    message: input.compatible
      ? `Target studio '${input.studioType}' is compatible for contract '${input.contractId}'.`
      : `Target studio '${input.studioType}' is not compatible for contract '${input.contractId}'.`,
    studioType: input.studioType,
    contractId: input.contractId,
  });
}

export class SystemStudioCompositionPriorityRule implements StudioHandoffRoutingRule {
  public readonly id = "studio-handoff-routing-rule:system-composition-priority";

  public evaluate(input: StudioHandoffRoutingRuleContext): StudioHandoffRoutingRuleResult {
    if (!input.compatibility.compatible) {
      return Object.freeze({});
    }

    const grouped = Boolean(input.request.multiAsset ?? input.request.existingHandoff?.multiAsset);
    const systemIntent = input.request.intent?.kind === StudioHandoffIntentKinds.systemIntegration;
    const compositionIntent = input.request.intent?.kind === StudioHandoffIntentKinds.compositionAssembly;
    const structuralKind = input.request.sourceOutput.authoritativeAsset.taxonomy.structuralKind;

    const shouldPrioritizeSystem = input.descriptor.studioType === "system-studio"
      && (
        grouped
        || structuralKind === "system"
        || systemIntent
        || compositionIntent
      );

    if (!shouldPrioritizeSystem) {
      return Object.freeze({});
    }

    return Object.freeze({
      scoreDelta: 50,
      reasons: Object.freeze([freezeReason({
        code: StudioHandoffRoutingReasonCodes.systemStudioPreferredForComposition,
        message: "System Studio received composition-priority routing boost for grouped/system/composition-oriented handoff intake.",
        studioType: input.descriptor.studioType,
        contractId: input.selectedContract.contractId,
      })]),
    });
  }
}

export class GroupedMultiAssetSupportRule implements StudioHandoffRoutingRule {
  public readonly id = "studio-handoff-routing-rule:grouped-multi-asset-support";

  public evaluate(input: StudioHandoffRoutingRuleContext): StudioHandoffRoutingRuleResult {
    const grouped = Boolean(input.request.multiAsset ?? input.request.existingHandoff?.multiAsset);
    if (!grouped) {
      return Object.freeze({});
    }

    const supportsGrouped = input.descriptor.acceptsMultiAssetHandoffs
      || input.descriptor.acceptedInputs.some((entry) => entry.contract.contractId === input.selectedContract.contractId && entry.supportsGroupedMultiAsset);

    return Object.freeze({
      scoreDelta: supportsGrouped ? 15 : -25,
      reasons: Object.freeze([freezeReason({
        code: supportsGrouped
          ? StudioHandoffRoutingReasonCodes.groupedMultiAssetSupported
          : StudioHandoffRoutingReasonCodes.groupedMultiAssetUnsupported,
        message: supportsGrouped
          ? `Target studio '${input.descriptor.studioType}' supports grouped multi-asset handoffs for '${input.selectedContract.contractId}'.`
          : `Target studio '${input.descriptor.studioType}' does not declare grouped multi-asset support for '${input.selectedContract.contractId}'.`,
        studioType: input.descriptor.studioType,
        contractId: input.selectedContract.contractId,
      })]),
    });
  }
}

function ensureTargetContract(descriptor: StudioCapabilityDescriptor, contractId: string): TargetStudioInputContract {
  const matched = descriptor.acceptedInputs.find((entry) => entry.contract.contractId === contractId);
  if (!matched) {
    throw new Error(`Target studio '${descriptor.studioType}' does not declare input contract '${contractId}'.`);
  }
  return matched.contract;
}

function createCandidateHandoff(input: {
  readonly request: StudioHandoffRoutingRequest;
  readonly descriptor: StudioCapabilityDescriptor;
  readonly targetContract: TargetStudioInputContract;
}): StudioHandoffContract {
  if (input.request.existingHandoff) {
    const handoff = input.request.existingHandoff;
    const target: StudioHandoffTarget = Object.freeze({
      studioType: input.descriptor.studioType,
      studioId: input.descriptor.studioId ?? handoff.target.studioId,
      draftId: handoff.target.draftId,
      sessionId: handoff.target.sessionId,
    });
    return createStudioHandoffContract({
      id: handoff.id,
      source: handoff.source,
      target,
      payload: {
        ...handoff.payload,
        targetInputContract: input.targetContract,
      },
      context: handoff.context
        ? {
          sourceReferences: handoff.context.sourceReferences,
          actor: handoff.context.actor,
          prefill: handoff.context.prefill,
          provenance: handoff.context.provenance,
        }
        : undefined,
      multiAsset: input.request.multiAsset ?? handoff.multiAsset,
      intent: handoff.intent,
    });
  }

  const source = input.request.source ?? Object.freeze({
    studioType: input.request.sourceOutput.sourceStudioType,
    studioId: input.request.sourceOutput.sourceStudioId,
  });

  const target: StudioHandoffTarget = Object.freeze({
    studioType: input.descriptor.studioType,
    studioId: input.descriptor.studioId ?? `${input.descriptor.studioType}-default`,
  });

  return createStudioHandoffContract({
    id: input.request.handoffId ?? `${source.studioId}::${target.studioId}::${input.request.sourceOutput.authoritativeAsset.versionId}`,
    source,
    target,
    payload: {
      assetId: input.request.sourceOutput.authoritativeAsset.assetId,
      versionId: input.request.sourceOutput.authoritativeAsset.versionId,
      taxonomy: input.request.sourceOutput.authoritativeAsset.taxonomy,
      contract: input.request.sourceOutput.authoritativeAsset.contract,
      targetInputContract: input.targetContract,
    },
    multiAsset: input.request.multiAsset,
    context: {
      sourceReferences: input.request.context?.sourceReferences
        ?? input.request.sourceOutput.sourceReferences
        ?? [{
          assetId: input.request.sourceOutput.authoritativeAsset.assetId,
          versionId: input.request.sourceOutput.authoritativeAsset.versionId,
          relation: "source-output",
          studioId: source.studioId,
          studioType: source.studioType,
        }],
      actor: input.request.context?.actor,
      prefill: {
        values: {
          ...(input.request.sourceOutput.handoffHints ?? {}),
          ...(input.request.context?.prefill?.values ?? {}),
        },
      },
      provenance: {
        correlationId: input.request.context?.provenance?.correlationId ?? input.request.sourceOutput.provenance?.correlationId,
        labels: input.request.context?.provenance?.labels ?? input.request.sourceOutput.provenance?.labels,
        sourceDraftId: input.request.context?.provenance?.sourceDraftId,
        sourceSessionId: input.request.context?.provenance?.sourceSessionId,
        sourceVersionLineage: input.request.context?.provenance?.sourceVersionLineage,
        metadata: input.request.context?.provenance?.metadata,
      },
    },
    intent: input.request.intent ?? Object.freeze({ kind: StudioHandoffIntentKinds.compositionAssembly }),
  });
}

function ensureContext(handoff: StudioHandoffContract): StudioHandoffContext {
  if (handoff.context) {
    return handoff.context;
  }

  return createStudioHandoffContext({
    sourceStudioId: handoff.source.studioId,
    sourceStudioType: handoff.source.studioType,
    targetStudioId: handoff.target.studioId,
    targetStudioType: handoff.target.studioType,
    intent: handoff.intent,
    sourceReferences: [{
      assetId: handoff.payload.assetId,
      versionId: handoff.payload.versionId,
      relation: "source-output",
      studioId: handoff.source.studioId,
      studioType: handoff.source.studioType,
    }],
    prefill: {
      values: {},
    },
  });
}

export class StudioHandoffRoutingService {
  private readonly rules: ReadonlyArray<StudioHandoffRoutingRule>;

  public constructor(
    private readonly capabilityQuery: Pick<StudioCapabilityQueryService, "listCapabilities">,
    private readonly compatibilityValidator: Pick<StudioHandoffCompatibilityValidator, "validate">,
    rules?: ReadonlyArray<StudioHandoffRoutingRule>,
  ) {
    this.rules = rules ?? Object.freeze([
      new GroupedMultiAssetSupportRule(),
      new SystemStudioCompositionPriorityRule(),
    ]);
  }

  public route(request: StudioHandoffRoutingRequest): StudioHandoffRouteDecision {
    const descriptors = this.capabilityQuery.listCapabilities();
    const reasons: StudioHandoffRoutingReason[] = [];
    if (descriptors.length === 0) {
      reasons.push(freezeReason({
        code: StudioHandoffRoutingReasonCodes.noCapabilitiesRegistered,
        message: "No studio capability descriptors are registered for handoff routing.",
      }));
      return Object.freeze({
        candidates: Object.freeze([]),
        compatibleCandidates: Object.freeze([]),
        alternateCandidates: Object.freeze([]),
        reasons: Object.freeze(reasons),
        deterministicSignature: "none",
      });
    }

    const candidates: StudioHandoffRouteCandidate[] = [];

    for (const descriptor of descriptors) {
      if (descriptor.studioType === request.sourceOutput.sourceStudioType) {
        reasons.push(freezeReason({
          code: StudioHandoffRoutingReasonCodes.sourceStudioExcluded,
          message: `Source studio '${descriptor.studioType}' is excluded from target routing candidates.`,
          studioType: descriptor.studioType,
        }));
        continue;
      }

      let bestCandidate: StudioHandoffRouteCandidate | undefined;

      for (const acceptedInput of descriptor.acceptedInputs) {
        const targetContract = ensureTargetContract(descriptor, acceptedInput.contract.contractId);
        const handoff = createCandidateHandoff({
          request,
          descriptor,
          targetContract,
        });
        const context = ensureContext(handoff);
        const compatibility = this.compatibilityValidator.validate({
          handoff,
          targetCapabilities: [descriptor],
        });

        const ruleReasons: StudioHandoffRoutingReason[] = [
          freezeReason({
            code: StudioHandoffRoutingReasonCodes.contractEvaluated,
            message: `Evaluated target contract '${targetContract.contractId}' for studio '${descriptor.studioType}'.`,
            studioType: descriptor.studioType,
            contractId: targetContract.contractId,
          }),
          createCompatibilityRuleReason({
            compatible: compatibility.compatible,
            studioType: descriptor.studioType,
            contractId: targetContract.contractId,
          }),
        ];

        let score = 0;
        if (compatibility.compatible) {
          score += 100;
        } else {
          score -= 100;
          reasons.push(freezeReason({
            code: StudioHandoffRoutingReasonCodes.targetCapabilityRejected,
            message: `Studio '${descriptor.studioType}' failed compatibility for contract '${targetContract.contractId}'.`,
            studioType: descriptor.studioType,
            contractId: targetContract.contractId,
          }));
        }

        if (request.intent?.kind === StudioHandoffIntentKinds.systemIntegration && descriptor.registrationKind === "system") {
          score += 20;
          ruleReasons.push(freezeReason({
            code: StudioHandoffRoutingReasonCodes.intentPriorityBoost,
            message: "System-integration intent increased system registration target score.",
            studioType: descriptor.studioType,
            contractId: targetContract.contractId,
          }));
        }
        if (request.intent?.kind === StudioHandoffIntentKinds.authoringContinuation) {
          if (descriptor.registrationKind === "composite") {
            score += 15;
          } else if (descriptor.registrationKind === "atomic") {
            score += 5;
          }
        }

        for (const rule of this.rules) {
          const result = rule.evaluate({
            request,
            descriptor,
            selectedContract: targetContract,
            compatibility,
          });
          score += result.scoreDelta ?? 0;
          for (const reason of result.reasons ?? []) {
            ruleReasons.push(freezeReason(reason));
          }
        }

        const candidate: StudioHandoffRouteCandidate = Object.freeze({
          studioType: descriptor.studioType,
          studioId: descriptor.studioId ?? `${descriptor.studioType}-default`,
          registrationKind: descriptor.registrationKind,
          compatible: compatibility.compatible,
          score,
          matchedContractId: targetContract.contractId,
          compatibility,
          reasons: Object.freeze(ruleReasons),
        });

        if (!bestCandidate) {
          bestCandidate = candidate;
          continue;
        }

        const sorted = stableSortCandidates([bestCandidate, candidate]);
        bestCandidate = sorted[0];
      }

      if (bestCandidate) {
        candidates.push(bestCandidate);
      }
    }

    const ordered = stableSortCandidates(candidates);
    const compatible = Object.freeze(ordered.filter((entry) => entry.compatible));
    const preferred = compatible[0];

    const finalReasons = [...reasons];
    if (preferred) {
      finalReasons.push(freezeReason({
        code: StudioHandoffRoutingReasonCodes.selectedPreferredTarget,
        message: `Selected preferred target '${preferred.studioType}' with contract '${preferred.matchedContractId ?? "n/a"}'.`,
        studioType: preferred.studioType,
        contractId: preferred.matchedContractId,
      }));
    }

    const deterministicSignature = [
      request.sourceOutput.authoritativeAsset.assetId,
      request.sourceOutput.authoritativeAsset.versionId,
      ...ordered.map((entry) => `${entry.studioType}:${entry.matchedContractId ?? "none"}:${entry.score}:${entry.compatible ? "1" : "0"}`),
    ].join("|");

    return Object.freeze({
      preferred,
      candidates: ordered,
      compatibleCandidates: compatible,
      alternateCandidates: Object.freeze(compatible.slice(1)),
      reasons: Object.freeze(finalReasons),
      deterministicSignature,
    });
  }

  public reevaluate(request: StudioHandoffRoutingRequest): StudioHandoffRouteDecision {
    return this.route(request);
  }
}
