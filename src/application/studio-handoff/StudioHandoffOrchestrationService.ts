import {
  createStudioHandoffContract,
  type StudioHandoffContract,
  type StudioHandoffIntent,
  type StudioHandoffSource,
  type StudioHandoffTarget,
  type TargetStudioInputContract,
} from "@domain/studio-handoff/StudioHandoffContract";
import { createStudioHandoffContext, type StudioHandoffContext } from "@domain/studio-handoff/StudioHandoffContext";
import type { StudioHandoffCompatibilityDecision } from "./StudioHandoffCompatibilityValidator";
import type { StudioCapabilityDescriptor } from "./StudioCapabilityRegistry";
import {
  StudioHandoffAuditEventKinds,
  StudioHandoffAuditOutcomes,
} from "@domain/studio-handoff/StudioHandoffAuditTrail";
import type { StudioHandoffAuditTrailService } from "./StudioHandoffAuditTrailService";
import type { AdaptedStudioInput, StudioInputAdapterLayer } from "./StudioInputAdapter";
import type { AdaptedStudioOutput, StudioOutputAdapterLayer, StudioProducedOutput } from "./StudioOutputAdapter";
import type { StudioHandoffLineageRecord, StudioHandoffLineageTracker } from "./StudioHandoffLineageTracker";
import {
  StudioHandoffFailureHandler,
  type StudioHandoffFailure,
} from "./StudioHandoffFailure";

export interface StudioHandoffRequest {
  readonly handoff?: StudioHandoffContract;
  readonly handoffId?: string;
  readonly sourceOutput: StudioProducedOutput;
  readonly source?: StudioHandoffSource;
  readonly target?: StudioHandoffTarget;
  readonly targetInputContract?: TargetStudioInputContract;
  readonly intent?: StudioHandoffIntent;
  readonly context?: StudioHandoffContext;
  readonly targetCapabilities: ReadonlyArray<StudioCapabilityDescriptor>;
}

export interface StudioHandoffPreparation {
  readonly sourceOutput: AdaptedStudioOutput;
  readonly handoff: StudioHandoffContract;
  readonly context: StudioHandoffContext;
  readonly compatibility: StudioHandoffCompatibilityDecision;
  readonly targetInput: AdaptedStudioInput;
  readonly lineage?: StudioHandoffLineageRecord;
}

export interface StudioHandoffResult {
  readonly ok: boolean;
  readonly preparation?: StudioHandoffPreparation;
  readonly failure?: StudioHandoffFailure;
}

export const StudioHandoffVersionResolutionPolicyKinds = Object.freeze({
  strictPinned: "strict-pinned",
});

export type StudioHandoffVersionResolutionPolicy =
  typeof StudioHandoffVersionResolutionPolicyKinds[keyof typeof StudioHandoffVersionResolutionPolicyKinds];

export interface StudioHandoffRevision {
  readonly revisionId: string;
  readonly previousHandoffId: string;
  readonly updatedHandoffId: string;
  readonly createdAt: string;
}

export interface IncrementalStudioHandoffUpdate {
  readonly handoffId?: string;
  readonly revisionId?: string;
  readonly contextPrefillPatch?: Readonly<Record<string, unknown>>;
  readonly contextProvenancePatch?: {
    readonly correlationId?: string;
    readonly labels?: ReadonlyArray<string>;
  };
  readonly assetVersionUpdates?: ReadonlyArray<{
    readonly assetId: string;
    readonly versionId: string;
    readonly role?: string;
  }>;
}

export interface StudioHandoffChangeSet {
  readonly updatedAuthoritativeAsset: boolean;
  readonly updatedAuthoritativeVersion?: {
    readonly assetId: string;
    readonly previousVersionId: string;
    readonly nextVersionId: string;
  };
  readonly updatedBundleAssets: ReadonlyArray<{
    readonly assetId: string;
    readonly previousVersionId: string;
    readonly nextVersionId: string;
    readonly role?: string;
  }>;
  readonly updatedContextPrefillKeys: ReadonlyArray<string>;
  readonly updatedContextProvenanceFields: ReadonlyArray<string>;
}

export interface UpdatedStudioHandoffResult extends StudioHandoffResult {
  readonly revision?: StudioHandoffRevision;
  readonly changes?: StudioHandoffChangeSet;
}

interface StudioHandoffFailureSeed {
  readonly stage: "output-adaptation" | "contract" | "input-adaptation";
  readonly code: "output-adaptation-failed" | "request-invalid" | "contract-source-mismatch" | "contract-payload-mismatch" | "input-adaptation-failed";
  readonly message: string;
  readonly issues: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly path?: string;
  }>;
  readonly compatibility?: StudioHandoffCompatibilityDecision;
}

function resolveContract(input: {
  readonly request: StudioHandoffRequest;
  readonly adaptedOutput: AdaptedStudioOutput;
}): StudioHandoffContract | StudioHandoffFailureSeed {
  const existing = input.request.handoff;
  if (existing) {
    if (
      existing.source.studioType !== input.adaptedOutput.sourceStudioType
      || existing.source.studioId !== input.adaptedOutput.sourceStudioId
    ) {
      return Object.freeze({
        stage: "contract",
        code: "contract-source-mismatch",
        message: "Provided studio handoff contract source must match adapted source studio output identity.",
        issues: Object.freeze([{
          code: "contract-source-mismatch",
          message: "Handoff source studio identity does not match adapted source output studio identity.",
          path: "handoff.source",
        }]),
      });
    }

    if (
      existing.payload.assetId !== input.adaptedOutput.authoritativeAsset.assetId
      || existing.payload.versionId !== input.adaptedOutput.authoritativeAsset.versionId
      || existing.payload.taxonomy.structuralKind !== input.adaptedOutput.authoritativeAsset.taxonomy.structuralKind
      || existing.payload.taxonomy.semanticRole !== input.adaptedOutput.authoritativeAsset.taxonomy.semanticRole
      || existing.payload.taxonomy.behaviorKind !== input.adaptedOutput.authoritativeAsset.taxonomy.behaviorKind
    ) {
      return Object.freeze({
        stage: "contract",
        code: "contract-payload-mismatch",
        message: "Provided studio handoff contract payload must match adapted authoritative source output asset facts.",
        issues: Object.freeze([{
          code: "contract-payload-mismatch",
          message: "Handoff payload asset identity/version/taxonomy mismatched adapted source output authoritative facts.",
          path: "handoff.payload",
        }]),
      });
    }

    return existing;
  }

  const source = input.request.source;
  const target = input.request.target;
  const targetInputContract = input.request.targetInputContract;
  const intent = input.request.intent;

  if (!source || !target || !targetInputContract || !intent) {
    return Object.freeze({
      stage: "contract",
      code: "request-invalid",
      message: "Studio handoff request must include handoff or source/target/targetInputContract/intent for contract creation.",
      issues: Object.freeze([{
        code: "request-invalid",
        message: "Missing required handoff contract creation inputs.",
        path: "request",
      }]),
    });
  }

  return createStudioHandoffContract({
    id: input.request.handoffId ?? `${source.studioId}::${target.studioId}::${input.adaptedOutput.authoritativeAsset.versionId}`,
    source,
    target,
    payload: {
      assetId: input.adaptedOutput.authoritativeAsset.assetId,
      versionId: input.adaptedOutput.authoritativeAsset.versionId,
      taxonomy: input.adaptedOutput.authoritativeAsset.taxonomy,
      contract: input.adaptedOutput.authoritativeAsset.contract,
      targetInputContract,
    },
    intent,
    context: {
      sourceReferences: input.adaptedOutput.sourceReferences,
      prefill: {
        values: input.adaptedOutput.handoffMetadata.hints,
      },
      provenance: {
        correlationId: input.adaptedOutput.handoffMetadata.provenance?.correlationId,
        labels: input.adaptedOutput.handoffMetadata.provenance?.labels,
      },
    },
  });
}

function ensureContext(input: {
  readonly requestContext: StudioHandoffContext | undefined;
  readonly handoff: StudioHandoffContract;
  readonly adaptedOutput: AdaptedStudioOutput;
}): StudioHandoffContext {
  if (input.requestContext) {
    return input.requestContext;
  }
  if (input.handoff.context) {
    return input.handoff.context;
  }

  return createStudioHandoffContext({
    sourceStudioId: input.handoff.source.studioId,
    sourceStudioType: input.handoff.source.studioType,
    targetStudioId: input.handoff.target.studioId,
    targetStudioType: input.handoff.target.studioType,
    intent: input.handoff.intent,
    sourceReferences: input.adaptedOutput.sourceReferences.length > 0
      ? input.adaptedOutput.sourceReferences
      : [{
        assetId: input.adaptedOutput.authoritativeAsset.assetId,
        versionId: input.adaptedOutput.authoritativeAsset.versionId,
        relation: "source-output",
        studioId: input.adaptedOutput.sourceStudioId,
        studioType: input.adaptedOutput.sourceStudioType,
      }],
    prefill: {
      values: input.adaptedOutput.handoffMetadata.hints,
    },
    provenance: {
      correlationId: input.adaptedOutput.handoffMetadata.provenance?.correlationId,
      labels: input.adaptedOutput.handoffMetadata.provenance?.labels,
    },
  });
}

function applyIncrementalUpdate(input: {
  readonly basis: StudioHandoffContract;
  readonly update: IncrementalStudioHandoffUpdate;
}): {
  readonly handoff: StudioHandoffContract;
  readonly revision: StudioHandoffRevision;
  readonly changes: StudioHandoffChangeSet;
} {
  const byAsset = new Map((input.update.assetVersionUpdates ?? []).map((entry) => [entry.assetId, entry]));

  const updatedPayload = byAsset.get(input.basis.payload.assetId);
  const nextPayloadVersionId = updatedPayload?.versionId ?? input.basis.payload.versionId;
  const updatedAuthoritativeAsset = nextPayloadVersionId !== input.basis.payload.versionId;

  const nextBundleAssets = input.basis.multiAsset?.assets.map((entry) => {
    const update = byAsset.get(entry.assetId);
    return Object.freeze({
      ...entry,
      versionId: update?.versionId ?? entry.versionId,
      pinnedVersion: Object.freeze({
        assetId: entry.assetId,
        versionId: update?.versionId ?? entry.versionId,
      }),
      role: update?.role ?? entry.role,
    });
  });

  const updatedBundleAssets = (nextBundleAssets ?? [])
    .filter((entry, index) => entry.versionId !== input.basis.multiAsset?.assets[index]?.versionId)
    .map((entry, index) => Object.freeze({
      assetId: entry.assetId,
      previousVersionId: input.basis.multiAsset?.assets[index]?.versionId ?? entry.versionId,
      nextVersionId: entry.versionId,
      role: entry.role,
    }));

  const basePrefill = input.basis.context?.prefill?.values ?? {};
  const prefillPatch = input.update.contextPrefillPatch ?? {};
  const nextPrefill = Object.freeze({
    ...basePrefill,
    ...prefillPatch,
  });

  const baseProvenance = input.basis.context?.provenance;
  const nextProvenance = input.update.contextProvenancePatch
    ? {
      ...baseProvenance,
      ...input.update.contextProvenancePatch,
    }
    : baseProvenance;

  const updatedContextProvenanceFields = Object.keys(input.update.contextProvenancePatch ?? {});
  const updatedContextPrefillKeys = Object.keys(prefillPatch);

  const revisionId = input.update.revisionId ?? `${input.basis.id.value}:rev:${Date.now()}`;
  const nextHandoffId = input.update.handoffId ?? `${input.basis.id.value}:rev:${revisionId}`;

  const revised = createStudioHandoffContract({
    id: nextHandoffId,
    source: input.basis.source,
    target: input.basis.target,
    payload: {
      ...input.basis.payload,
      versionId: nextPayloadVersionId,
      pinnedVersion: {
        assetId: input.basis.payload.assetId,
        versionId: nextPayloadVersionId,
      },
    },
    multiAsset: input.basis.multiAsset
      ? {
        grouped: true,
        requireAllAssets: input.basis.multiAsset.requireAllAssets,
        assets: nextBundleAssets ?? input.basis.multiAsset.assets,
      }
      : undefined,
    intent: input.basis.intent,
    context: input.basis.context
      ? {
        initiatedAt: new Date(),
        actor: input.basis.context.actor,
        sourceReferences: (nextBundleAssets ?? input.basis.context.sourceReferences).map((entry) => ({
          assetId: entry.assetId,
          versionId: entry.versionId,
          relation: "role" in entry ? entry.role : entry.relation,
          studioId: "studioId" in entry ? entry.studioId : undefined,
          studioType: "studioType" in entry ? entry.studioType : undefined,
        })),
        prefill: {
          values: nextPrefill,
          hintOnlyKeys: Object.freeze(Object.keys(nextPrefill)),
        },
        provenance: nextProvenance,
      }
      : undefined,
  });

  return Object.freeze({
    handoff: revised,
    revision: Object.freeze({
      revisionId,
      previousHandoffId: input.basis.id.value,
      updatedHandoffId: revised.id.value,
      createdAt: new Date().toISOString(),
    }),
    changes: Object.freeze({
      updatedAuthoritativeAsset,
      updatedAuthoritativeVersion: updatedAuthoritativeAsset
        ? Object.freeze({
          assetId: input.basis.payload.assetId,
          previousVersionId: input.basis.payload.versionId,
          nextVersionId: nextPayloadVersionId,
        })
        : undefined,
      updatedBundleAssets: Object.freeze(updatedBundleAssets),
      updatedContextPrefillKeys: Object.freeze(updatedContextPrefillKeys),
      updatedContextProvenanceFields: Object.freeze(updatedContextProvenanceFields),
    }),
  });
}


function toAuditedAssets(handoff: StudioHandoffContract): ReadonlyArray<{
  readonly assetId: string;
  readonly versionId: string;
  readonly role?: string;
}> {
  if (!handoff.multiAsset) {
    return Object.freeze([{
      assetId: handoff.payload.pinnedVersion?.assetId ?? handoff.payload.assetId,
      versionId: handoff.payload.pinnedVersion?.versionId ?? handoff.payload.versionId,
      role: "primary",
    }]);
  }

  return Object.freeze(handoff.multiAsset.assets.map((entry) => Object.freeze({
    assetId: entry.pinnedVersion?.assetId ?? entry.assetId,
    versionId: entry.pinnedVersion?.versionId ?? entry.versionId,
    role: entry.role,
  })));
}

export class StudioHandoffOrchestrationService {
  private readonly failureHandler: StudioHandoffFailureHandler;

  public constructor(
    private readonly outputAdapterLayer: Pick<StudioOutputAdapterLayer, "adapt">,
    private readonly inputAdapterLayer: Pick<StudioInputAdapterLayer, "adapt">,
    private readonly options: {
      readonly versionPolicy?: StudioHandoffVersionResolutionPolicy;
      readonly lineageTracker?: Pick<StudioHandoffLineageTracker, "track">;
      readonly auditTrail?: Pick<StudioHandoffAuditTrailService, "record">;
      readonly failureHandler?: StudioHandoffFailureHandler;
    } = {},
  ) {
    this.failureHandler = this.options.failureHandler ?? new StudioHandoffFailureHandler();
  }

  public orchestrate(request: StudioHandoffRequest): StudioHandoffResult {
    const versionPolicy = this.options.versionPolicy ?? StudioHandoffVersionResolutionPolicyKinds.strictPinned;
    if (versionPolicy !== StudioHandoffVersionResolutionPolicyKinds.strictPinned) {
      throw new Error(`Unsupported StudioHandoffVersionResolutionPolicy '${versionPolicy}'.`);
    }

    const outputAdaptation = this.outputAdapterLayer.adapt(request.sourceOutput);
    if (!outputAdaptation.ok || !outputAdaptation.adapted) {
      return Object.freeze({
        ok: false,
        failure: this.failureHandler.createFailure({
          stage: "output-adaptation",
          code: "output-adaptation-failed",
          message: "Source studio output adaptation failed before handoff orchestration.",
          issues: Object.freeze(outputAdaptation.issues),
          context: Object.freeze({
            handoffId: request.handoff?.id.value ?? request.handoffId,
            sourceStudioId: request.sourceOutput.sourceStudioId,
            sourceStudioType: request.sourceOutput.sourceStudioType,
            targetStudioId: request.target?.studioId ?? request.handoff?.target.studioId,
            targetStudioType: request.target?.studioType ?? request.handoff?.target.studioType,
            impactedAssets: Object.freeze([{
              assetId: request.sourceOutput.authoritativeAsset.assetId,
              versionId: request.sourceOutput.authoritativeAsset.versionId,
              role: "primary",
            }]),
          }),
        }),
      });
    }

    const contract = resolveContract({
      request,
      adaptedOutput: outputAdaptation.adapted,
    });

    if ("stage" in contract) {
      return Object.freeze({
        ok: false,
        failure: this.failureHandler.createFailure({
          ...contract,
          context: Object.freeze({
            handoffId: request.handoff?.id.value ?? request.handoffId,
            sourceStudioId: request.source?.studioId ?? outputAdaptation.adapted.sourceStudioId,
            sourceStudioType: request.source?.studioType ?? outputAdaptation.adapted.sourceStudioType,
            targetStudioId: request.target?.studioId ?? request.handoff?.target.studioId,
            targetStudioType: request.target?.studioType ?? request.handoff?.target.studioType,
            impactedAssets: Object.freeze([{
              assetId: outputAdaptation.adapted.authoritativeAsset.assetId,
              versionId: outputAdaptation.adapted.authoritativeAsset.versionId,
              role: "primary",
            }]),
          }),
        }),
      });
    }

    const context = ensureContext({
      requestContext: request.context,
      handoff: contract,
      adaptedOutput: outputAdaptation.adapted,
    });

    this.options.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.handoffCreated,
      outcome: StudioHandoffAuditOutcomes.accepted,
      handoff: { handoffId: contract.id.value },
      actor: context.actor,
      sourceStudio: { studioId: contract.source.studioId, studioType: contract.source.studioType },
      targetStudio: { studioId: contract.target.studioId, studioType: contract.target.studioType },
      assets: toAuditedAssets(contract),
      detail: {
        statusCode: "created",
      },
    });

    const inputAdaptation = this.inputAdapterLayer.adapt({
      handoff: contract,
      context,
      targetCapabilities: request.targetCapabilities,
    });

    this.options.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.compatibilityEvaluated,
      outcome: inputAdaptation.compatibility.compatible ? StudioHandoffAuditOutcomes.succeeded : StudioHandoffAuditOutcomes.rejected,
      handoff: { handoffId: contract.id.value },
      actor: context.actor,
      sourceStudio: { studioId: contract.source.studioId, studioType: contract.source.studioType },
      targetStudio: { studioId: contract.target.studioId, studioType: contract.target.studioType },
      assets: toAuditedAssets(contract),
      detail: {
        statusCode: inputAdaptation.compatibility.compatible ? "compatible" : "incompatible",
        issueCodes: inputAdaptation.compatibility.issues.map((entry) => entry.code),
        matchedContractId: inputAdaptation.compatibility.matchedContractId,
        compatibilityPassed: inputAdaptation.compatibility.compatible,
      },
    });

    if (!inputAdaptation.ok || !inputAdaptation.adapted) {
      this.options.auditTrail?.record({
        eventKind: StudioHandoffAuditEventKinds.handoffFailed,
        outcome: StudioHandoffAuditOutcomes.failed,
        handoff: { handoffId: contract.id.value },
        actor: context.actor,
        sourceStudio: { studioId: contract.source.studioId, studioType: contract.source.studioType },
        targetStudio: { studioId: contract.target.studioId, studioType: contract.target.studioType },
        assets: toAuditedAssets(contract),
        detail: {
          statusCode: "input-adaptation-failed",
          issueCodes: ["input-adaptation-failed", ...inputAdaptation.issues.map((entry) => entry.code)],
          compatibilityPassed: false,
        },
      });
      return Object.freeze({
        ok: false,
        failure: this.failureHandler.createFailure({
          stage: "input-adaptation",
          code: "input-adaptation-failed",
          message: "Target studio input adaptation failed during handoff orchestration.",
          compatibility: inputAdaptation.compatibility,
          issues: Object.freeze(inputAdaptation.issues),
          context: Object.freeze({
            handoffId: contract.id.value,
            sourceStudioId: contract.source.studioId,
            sourceStudioType: contract.source.studioType,
            targetStudioId: contract.target.studioId,
            targetStudioType: contract.target.studioType,
            impactedAssets: Object.freeze(toAuditedAssets(contract).map((entry) => Object.freeze({
              assetId: entry.assetId,
              versionId: entry.versionId,
              role: entry.role,
            }))),
          }),
        }),
      });
    }

    const preparation: StudioHandoffPreparation = Object.freeze({
      sourceOutput: outputAdaptation.adapted,
      handoff: contract,
      context,
      compatibility: inputAdaptation.compatibility,
      targetInput: inputAdaptation.adapted,
    });
    const lineageEvent = this.options.lineageTracker?.track({ preparation });

    this.options.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.handoffOrchestrated,
      outcome: StudioHandoffAuditOutcomes.succeeded,
      handoff: { handoffId: contract.id.value },
      actor: context.actor,
      sourceStudio: { studioId: contract.source.studioId, studioType: contract.source.studioType },
      targetStudio: { studioId: contract.target.studioId, studioType: contract.target.studioType },
      assets: toAuditedAssets(contract),
      detail: {
        statusCode: "prepared",
        matchedContractId: inputAdaptation.compatibility.matchedContractId,
        targetInputKind: inputAdaptation.adapted.kind,
        compatibilityPassed: true,
      },
    });

    return Object.freeze({
      ok: true,
      preparation: Object.freeze({
        ...preparation,
        lineage: lineageEvent?.record,
      }),
    });
  }

  public refreshStudioHandoff(input: {
    readonly basis: StudioHandoffContract;
    readonly update: IncrementalStudioHandoffUpdate;
    readonly sourceOutput: StudioProducedOutput;
    readonly targetCapabilities: ReadonlyArray<StudioCapabilityDescriptor>;
  }): UpdatedStudioHandoffResult {
    const revised = applyIncrementalUpdate({
      basis: input.basis,
      update: input.update,
    });

    const orchestrationForRefresh = this.options.lineageTracker
      ? new StudioHandoffOrchestrationService(
        this.outputAdapterLayer,
        this.inputAdapterLayer,
        { versionPolicy: this.options.versionPolicy },
      )
      : this;

    const result = orchestrationForRefresh.orchestrate({
      handoff: revised.handoff,
      sourceOutput: input.sourceOutput,
      targetCapabilities: input.targetCapabilities,
    });

    if (!result.ok || !result.preparation || !this.options.lineageTracker) {
      this.options.auditTrail?.record({
        eventKind: StudioHandoffAuditEventKinds.handoffUpdated,
        outcome: result.ok ? StudioHandoffAuditOutcomes.accepted : StudioHandoffAuditOutcomes.rejected,
        handoff: {
          handoffId: revised.handoff.id.value,
          revisionId: revised.revision.revisionId,
          previousHandoffId: revised.revision.previousHandoffId,
        },
        actor: revised.handoff.context?.actor,
        sourceStudio: { studioId: revised.handoff.source.studioId, studioType: revised.handoff.source.studioType },
        targetStudio: { studioId: revised.handoff.target.studioId, studioType: revised.handoff.target.studioType },
        assets: toAuditedAssets(revised.handoff),
        detail: {
          statusCode: result.ok ? "revision-prepared" : "revision-rejected",
          compatibilityPassed: result.ok,
        },
      });
      return Object.freeze({
        ...result,
        revision: revised.revision,
        changes: revised.changes,
      });
    }

    const lineageEvent = this.options.lineageTracker.track({
      preparation: result.preparation,
      revision: revised.revision,
    });

    this.options.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.handoffUpdated,
      outcome: StudioHandoffAuditOutcomes.succeeded,
      handoff: {
        handoffId: revised.handoff.id.value,
        revisionId: revised.revision.revisionId,
        previousHandoffId: revised.revision.previousHandoffId,
      },
      actor: revised.handoff.context?.actor,
      sourceStudio: { studioId: revised.handoff.source.studioId, studioType: revised.handoff.source.studioType },
      targetStudio: { studioId: revised.handoff.target.studioId, studioType: revised.handoff.target.studioType },
      assets: toAuditedAssets(revised.handoff),
      detail: {
        statusCode: "revision-prepared",
        compatibilityPassed: true,
      },
    });

    return Object.freeze({
      ...result,
      preparation: Object.freeze({
        ...result.preparation,
        lineage: lineageEvent.record,
      }),
      revision: revised.revision,
      changes: revised.changes,
    });
  }
}

