import type { StudioHandoffCompatibilityDecision } from "./StudioHandoffCompatibilityValidator";

export const StudioHandoffFailureKinds = Object.freeze({
  compatibilityFailure: "compatibility-failure",
  routingFailure: "routing-failure",
  adapterFailure: "adapter-failure",
  invalidGroupedHandoff: "invalid-grouped-handoff",
  versionReferenceFailure: "version-reference-failure",
  systemOfSystemsFailure: "system-of-systems-failure",
  persistenceFailure: "persistence-failure",
  orchestrationFailure: "orchestration-failure",
  invalidRevisionRequest: "invalid-revision-request",
  rejectedBeforeOrchestration: "rejected-before-orchestration",
});

export type StudioHandoffFailureKind =
  typeof StudioHandoffFailureKinds[keyof typeof StudioHandoffFailureKinds];

export const StudioHandoffRejectionReasons = Object.freeze({
  compatibilityRejected: "compatibility-rejected",
  routingRejected: "routing-rejected",
  adapterRejected: "adapter-rejected",
  groupedInputRejected: "grouped-input-rejected",
  versionReferenceRejected: "version-reference-rejected",
  systemOfSystemsRejected: "system-of-systems-rejected",
  persistenceRejected: "persistence-rejected",
  invalidRevisionRejected: "invalid-revision-rejected",
});

export type StudioHandoffRejectionReason =
  typeof StudioHandoffRejectionReasons[keyof typeof StudioHandoffRejectionReasons];

export interface StudioHandoffFailureContext {
  readonly handoffId?: string;
  readonly sourceStudioId?: string;
  readonly sourceStudioType?: string;
  readonly targetStudioId?: string;
  readonly targetStudioType?: string;
  readonly impactedAssets: ReadonlyArray<{
    readonly assetId: string;
    readonly versionId?: string;
    readonly role?: string;
  }>;
  readonly revisionId?: string;
}

export interface StudioHandoffFailure {
  readonly kind: StudioHandoffFailureKind;
  readonly rejectionReason: StudioHandoffRejectionReason;
  readonly stage: "output-adaptation" | "contract" | "input-adaptation" | "revision" | "persistence" | "routing";
  readonly code:
    | "output-adaptation-failed"
    | "request-invalid"
    | "contract-source-mismatch"
    | "contract-payload-mismatch"
    | "input-adaptation-failed"
    | "revision-invalid"
    | "routing-failed"
    | "persistence-failed";
  readonly message: string;
  readonly issues: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly path?: string;
  }>;
  readonly context: StudioHandoffFailureContext;
  readonly compatibility?: StudioHandoffCompatibilityDecision;
}

export interface StudioHandoffFailureResult {
  readonly ok: false;
  readonly failure: StudioHandoffFailure;
}

export class StudioHandoffFailureHandler {
  public createFailure(input: Omit<StudioHandoffFailure, "kind" | "rejectionReason">): StudioHandoffFailure {
    return Object.freeze({
      ...input,
      kind: this.classifyKind(input),
      rejectionReason: this.classifyRejectionReason(input),
    });
  }

  private classifyKind(input: Omit<StudioHandoffFailure, "kind" | "rejectionReason">): StudioHandoffFailureKind {
    if (input.code === "routing-failed") {
      return StudioHandoffFailureKinds.routingFailure;
    }
    if (input.code === "persistence-failed") {
      return StudioHandoffFailureKinds.persistenceFailure;
    }
    if (input.code === "revision-invalid") {
      return StudioHandoffFailureKinds.invalidRevisionRequest;
    }
    if (input.compatibility?.issues.some((entry) => entry.code === "bundle-asset-incompatible")) {
      return StudioHandoffFailureKinds.invalidGroupedHandoff;
    }
    if (input.compatibility?.issues.some((entry) => entry.code === "version-reference-invalid" || entry.code === "version-reference-mismatch")) {
      return StudioHandoffFailureKinds.versionReferenceFailure;
    }
    if (input.compatibility?.issues.some((entry) => entry.code === "taxonomy-incompatible")
      && input.context.impactedAssets.some((entry) => entry.role?.includes("system"))) {
      return StudioHandoffFailureKinds.systemOfSystemsFailure;
    }
    if (input.stage === "output-adaptation" || input.stage === "input-adaptation") {
      return StudioHandoffFailureKinds.adapterFailure;
    }
    if (input.stage === "contract") {
      return StudioHandoffFailureKinds.rejectedBeforeOrchestration;
    }
    return StudioHandoffFailureKinds.orchestrationFailure;
  }

  private classifyRejectionReason(input: Omit<StudioHandoffFailure, "kind" | "rejectionReason">): StudioHandoffRejectionReason {
    if (input.code === "routing-failed") {
      return StudioHandoffRejectionReasons.routingRejected;
    }
    if (input.code === "persistence-failed") {
      return StudioHandoffRejectionReasons.persistenceRejected;
    }
    if (input.code === "revision-invalid") {
      return StudioHandoffRejectionReasons.invalidRevisionRejected;
    }
    if (input.compatibility?.issues.some((entry) => entry.code === "bundle-asset-incompatible")) {
      return StudioHandoffRejectionReasons.groupedInputRejected;
    }
    if (input.compatibility?.issues.some((entry) => entry.code === "version-reference-invalid" || entry.code === "version-reference-mismatch")) {
      return StudioHandoffRejectionReasons.versionReferenceRejected;
    }
    if (input.compatibility?.issues.some((entry) => entry.code === "taxonomy-incompatible")
      && input.context.impactedAssets.some((entry) => entry.role?.includes("system"))) {
      return StudioHandoffRejectionReasons.systemOfSystemsRejected;
    }
    if (input.stage === "output-adaptation" || input.stage === "input-adaptation") {
      return StudioHandoffRejectionReasons.adapterRejected;
    }
    return StudioHandoffRejectionReasons.compatibilityRejected;
  }
}
