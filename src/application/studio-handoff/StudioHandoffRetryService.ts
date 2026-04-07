import { StudioHandoffAuditEventKinds, StudioHandoffAuditOutcomes } from "../../domain/studio-handoff/StudioHandoffAuditTrail";
import type { StudioHandoffContract } from "../../domain/studio-handoff/StudioHandoffContract";
import type { StudioHandoffContext } from "../../domain/studio-handoff/StudioHandoffContext";
import type { StudioHandoffFailure, StudioHandoffFailureKind, StudioHandoffRejectionReason } from "./StudioHandoffFailure";
import type { StudioHandoffRequest, StudioHandoffResult } from "./StudioHandoffOrchestrationService";
import type {
  PersistedStudioHandoffRecord,
  StudioHandoffPersistenceService,
  StudioHandoffQueryService,
  StudioHandoffRetryLinkRecord,
} from "./StudioHandoffPersistenceService";

export const StudioHandoffRetryDecisionKinds = Object.freeze({
  retryable: "retryable",
  reconcilable: "reconcilable",
  terminal: "terminal",
} as const);

export type StudioHandoffRetryDecisionKind =
  typeof StudioHandoffRetryDecisionKinds[keyof typeof StudioHandoffRetryDecisionKinds];

export interface StudioHandoffRetryDecision {
  readonly decision: StudioHandoffRetryDecisionKind;
  readonly reasonCode: string;
  readonly reason: string;
}

export interface StudioHandoffRetryLink extends StudioHandoffRetryLinkRecord {}

export interface StudioHandoffReconciliationRequest {
  readonly handoffId: string;
  readonly sourceOutput: StudioHandoffRequest["sourceOutput"];
  readonly targetCapabilities: StudioHandoffRequest["targetCapabilities"];
  readonly basisHandoff: StudioHandoffContract;
  readonly contextOverride?: StudioHandoffContext;
  readonly source?: StudioHandoffRequest["source"];
  readonly target?: StudioHandoffRequest["target"];
  readonly targetInputContract?: StudioHandoffRequest["targetInputContract"];
  readonly intent?: StudioHandoffRequest["intent"];
}

export interface StudioHandoffReconciliationResult {
  readonly decision: StudioHandoffRetryDecision;
  readonly allowed: boolean;
  readonly retryLink?: StudioHandoffRetryLink;
  readonly persisted?: PersistedStudioHandoffRecord;
  readonly result?: StudioHandoffResult;
}

export class StudioHandoffRetryableFailureClassifier {
  public classify(input: {
    readonly failure: StudioHandoffFailure;
    readonly record: PersistedStudioHandoffRecord;
  }): StudioHandoffRetryDecision {
    const issueCodes = new Set(input.failure.issues.map((entry) => entry.code));

    if (input.failure.kind === "persistence-failure" || input.failure.kind === "routing-failure") {
      return Object.freeze({
        decision: StudioHandoffRetryDecisionKinds.retryable,
        reasonCode: input.failure.kind,
        reason: "Handoff failed due to an operational concern that can be retried deterministically with identical inputs.",
      });
    }

    if (this.isVersionOrCompatibilityFixable(input.failure.kind, input.failure.rejectionReason, issueCodes)) {
      return Object.freeze({
        decision: StudioHandoffRetryDecisionKinds.reconcilable,
        reasonCode: "requires-reconciliation",
        reason: "Handoff failure can be retried only after bounded source version/context/target contract reconciliation.",
      });
    }

    return Object.freeze({
      decision: StudioHandoffRetryDecisionKinds.terminal,
      reasonCode: "terminal-handoff-failure",
      reason: "Handoff failure is terminal for the persisted attempt and cannot be replayed without violating bounded retry semantics.",
    });
  }

  private isVersionOrCompatibilityFixable(
    kind: StudioHandoffFailureKind,
    rejectionReason: StudioHandoffRejectionReason,
    issueCodes: ReadonlySet<string>,
  ): boolean {
    if (kind === "version-reference-failure" || kind === "invalid-grouped-handoff" || kind === "system-of-systems-failure") {
      return true;
    }
    if (rejectionReason === "version-reference-rejected" || rejectionReason === "grouped-input-rejected") {
      return true;
    }
    return issueCodes.has("taxonomy-incompatible")
      || issueCodes.has("version-reference-invalid")
      || issueCodes.has("version-reference-mismatch")
      || issueCodes.has("bundle-asset-incompatible");
  }
}

export class StudioHandoffRetryService {
  public constructor(
    private readonly query: Pick<StudioHandoffQueryService, "getByHandoffId">,
    private readonly persistence: Pick<StudioHandoffPersistenceService, "persistPrepared" | "persistFailure">,
    private readonly orchestration: Pick<{ orchestrate(request: StudioHandoffRequest): StudioHandoffResult }, "orchestrate">,
    private readonly classifier: Pick<StudioHandoffRetryableFailureClassifier, "classify"> = new StudioHandoffRetryableFailureClassifier(),
    private readonly auditTrail?: {
      record(input: {
        readonly eventKind: string;
        readonly outcome: string;
        readonly handoff: { readonly handoffId: string; readonly previousHandoffId?: string };
        readonly actor?: StudioHandoffContext["actor"];
        readonly sourceStudio: { readonly studioId: string; readonly studioType: string };
        readonly targetStudio: { readonly studioId: string; readonly studioType: string };
        readonly assets: ReadonlyArray<{ readonly assetId: string; readonly versionId: string; readonly role?: string }>;
        readonly detail?: {
          readonly statusCode?: string;
          readonly message?: string;
          readonly issueCodes?: ReadonlyArray<string>;
          readonly compatibilityPassed?: boolean;
        };
      }): unknown;
    },
  ) {}

  public async retryFailedHandoff(input: StudioHandoffReconciliationRequest): Promise<StudioHandoffReconciliationResult> {
    return this.retryOrReconcile(input, "retry");
  }

  public async reconcileFailedHandoff(input: StudioHandoffReconciliationRequest): Promise<StudioHandoffReconciliationResult> {
    return this.retryOrReconcile(input, "reconciliation");
  }

  private async retryOrReconcile(
    input: StudioHandoffReconciliationRequest,
    requestedAttemptKind: "retry" | "reconciliation",
  ): Promise<StudioHandoffReconciliationResult> {
    const existing = await this.query.getByHandoffId(input.handoffId);
    if (!existing || existing.orchestration.status !== "failed") {
      return Object.freeze({
        allowed: false,
        decision: Object.freeze({
          decision: StudioHandoffRetryDecisionKinds.terminal,
          reasonCode: "handoff-not-failed",
          reason: "Retry/reconciliation requires an existing failed handoff record.",
        }),
      });
    }

    const failure = this.toFailure(existing);
    const classified = this.classifier.classify({ failure, record: existing });

    if (classified.decision === StudioHandoffRetryDecisionKinds.terminal
      || (requestedAttemptKind === "retry" && classified.decision !== StudioHandoffRetryDecisionKinds.retryable)
      || (requestedAttemptKind === "reconciliation" && classified.decision === StudioHandoffRetryDecisionKinds.retryable)) {
      return Object.freeze({
        allowed: false,
        decision: classified,
      });
    }

    const result = this.orchestration.orchestrate({
      handoff: input.basisHandoff,
      sourceOutput: input.sourceOutput,
      source: input.source,
      target: input.target,
      targetInputContract: input.targetInputContract,
      context: input.contextOverride,
      intent: input.intent,
      targetCapabilities: input.targetCapabilities,
    });

    const retryLink: StudioHandoffRetryLink = Object.freeze({
      attemptKind: requestedAttemptKind,
      decision: classified.decision,
      reasonCode: classified.reasonCode,
      reason: classified.reason,
      sourceHandoffId: input.handoffId,
      targetHandoffId: input.basisHandoff.id.value,
      initiatedAt: new Date().toISOString(),
    });

    const persisted = result.ok && result.preparation
      ? await this.persistence.persistPrepared({ preparation: result.preparation, retryLink })
      : await this.persistence.persistFailure({
        handoff: input.basisHandoff,
        context: this.resolveFailureContext(input),
        failure: result.failure ?? failure,
        retryLink,
      });

    this.auditTrail?.record({
      eventKind: StudioHandoffAuditEventKinds.handoffUpdated,
      outcome: persisted.orchestration.status === "prepared" ? StudioHandoffAuditOutcomes.succeeded : StudioHandoffAuditOutcomes.failed,
      handoff: {
        handoffId: retryLink.targetHandoffId,
        previousHandoffId: retryLink.sourceHandoffId,
      },
      actor: input.contextOverride?.actor ?? input.basisHandoff.context?.actor,
      sourceStudio: {
        studioId: input.basisHandoff.source.studioId,
        studioType: input.basisHandoff.source.studioType,
      },
      targetStudio: {
        studioId: input.basisHandoff.target.studioId,
        studioType: input.basisHandoff.target.studioType,
      },
      assets: persisted.bundledAssets,
      detail: {
        statusCode: requestedAttemptKind,
        message: classified.reason,
        issueCodes: persisted.orchestration.issueCodes,
        compatibilityPassed: persisted.orchestration.status === "prepared",
      },
    });

    return Object.freeze({
      allowed: true,
      decision: classified,
      retryLink,
      persisted,
      result,
    });
  }

  private toFailure(record: PersistedStudioHandoffRecord): StudioHandoffFailure {
    const issueCodes = record.orchestration.issueCodes;
    const primaryCode = issueCodes[0] ?? "input-adaptation-failed";

    const kind = this.toFailureKind(issueCodes);
    const rejectionReason = this.toRejectionReason(kind);
    return Object.freeze({
      kind,
      rejectionReason,
      stage: "input-adaptation",
      code: primaryCode === "routing-failed" || primaryCode === "persistence-failed" ? primaryCode : "input-adaptation-failed",
      message: `Recovered persisted failure for ${record.handoffId}.`,
      issues: Object.freeze(issueCodes.map((code) => Object.freeze({ code, message: code }))),
      context: Object.freeze({
        handoffId: record.handoffId,
        sourceStudioId: record.sourceStudioId,
        sourceStudioType: record.sourceStudioType,
        targetStudioId: record.targetStudioId,
        targetStudioType: record.targetStudioType,
        impactedAssets: Object.freeze(record.bundledAssets.map((entry) => Object.freeze({
          assetId: entry.assetId,
          versionId: entry.versionId,
          role: entry.role,
        }))),
      }),
      compatibility: {
        compatible: false,
        targetStudioType: record.targetStudioType,
        matchedContractId: record.orchestration.matchedContractId,
        issues: Object.freeze(issueCodes.map((code) => Object.freeze({ code, message: code }))),
      },
    });
  }

  private resolveFailureContext(input: StudioHandoffReconciliationRequest): StudioHandoffContext {
    if (input.contextOverride) {
      return input.contextOverride;
    }
    if (input.basisHandoff.context) {
      return input.basisHandoff.context;
    }
    return Object.freeze({
      sourceStudioId: input.basisHandoff.source.studioId,
      sourceStudioType: input.basisHandoff.source.studioType,
      targetStudioId: input.basisHandoff.target.studioId,
      targetStudioType: input.basisHandoff.target.studioType,
      intent: input.basisHandoff.intent,
      sourceReferences: Object.freeze([{
        assetId: input.basisHandoff.payload.assetId,
        versionId: input.basisHandoff.payload.versionId,
        relation: "primary",
      }]),
    });
  }

  private toFailureKind(issueCodes: ReadonlyArray<string>): StudioHandoffFailureKind {
    if (issueCodes.includes("persistence-failed")) {
      return "persistence-failure";
    }
    if (issueCodes.includes("routing-failed")) {
      return "routing-failure";
    }
    if (issueCodes.some((entry) => entry === "version-reference-invalid" || entry === "version-reference-mismatch")) {
      return "version-reference-failure";
    }
    if (issueCodes.includes("bundle-asset-incompatible")) {
      return "invalid-grouped-handoff";
    }
    if (issueCodes.includes("taxonomy-incompatible")) {
      return "system-of-systems-failure";
    }
    return "orchestration-failure";
  }

  private toRejectionReason(kind: StudioHandoffFailureKind): StudioHandoffRejectionReason {
    if (kind === "persistence-failure") {
      return "persistence-rejected";
    }
    if (kind === "routing-failure") {
      return "routing-rejected";
    }
    if (kind === "version-reference-failure") {
      return "version-reference-rejected";
    }
    if (kind === "invalid-grouped-handoff") {
      return "grouped-input-rejected";
    }
    if (kind === "system-of-systems-failure") {
      return "system-of-systems-rejected";
    }
    return "compatibility-rejected";
  }
}
