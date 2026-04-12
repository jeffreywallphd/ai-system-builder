import { describe, expect, it } from "bun:test";
import {
  ImageManipulationFailureDispositions,
  ImageManipulationFailureSummaryCategories,
  ImageManipulationIssueKinds,
  ImageManipulationIssueLayers,
  createImageManipulationIssueClassification,
} from "../ImageManipulationValidationFailureTaxonomy";
import {
  ImageManipulationResilienceScopes,
  ImageManipulationResilienceStateKinds,
  createImageManipulationResilienceCondition,
  createImageManipulationResilienceSnapshot,
} from "../ImageManipulationResilienceStateContracts";
import {
  ImageManipulationEscalationCategories,
  ImageManipulationRecoveryActionHintKinds,
  ImageManipulationRetryModes,
  deriveImageManipulationRetryRecoveryContractFromClassification,
  deriveImageManipulationRetryRecoveryContractFromResilienceCondition,
  deriveImageManipulationRetryRecoveryContractFromResilienceSnapshot,
} from "../ImageManipulationRetryRecoveryContracts";

describe("ImageManipulationRetryRecoveryContracts", () => {
  it("classifies validation failures as user-action-required and terminal-not-retryable", () => {
    const classification = createImageManipulationIssueClassification({
      layer: ImageManipulationIssueLayers.workflowConfiguration,
      kind: ImageManipulationIssueKinds.validation,
      summaryCategory: ImageManipulationFailureSummaryCategories.validation,
      disposition: ImageManipulationFailureDispositions.terminal,
      reason: "invalid-binding",
    });

    const recovery = deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: false,
    });

    expect(recovery.retry.retryMode).toBe(ImageManipulationRetryModes.none);
    expect(recovery.recoveryAction.kind).toBe(ImageManipulationRecoveryActionHintKinds.userActionRequired);
    expect(recovery.recoveryAction.userActionRequired).toBeTrue();
    expect(recovery.recoveryAction.terminalNotRetryable).toBeTrue();
    expect(recovery.escalation.category).toBe(ImageManipulationEscalationCategories.none);
  });

  it("classifies retryable operational failures as retry-safe and non-escalating", () => {
    const classification = createImageManipulationIssueClassification({
      layer: ImageManipulationIssueLayers.nodeAvailability,
      kind: ImageManipulationIssueKinds.operational,
      summaryCategory: ImageManipulationFailureSummaryCategories.timeout,
      disposition: ImageManipulationFailureDispositions.retryable,
      reason: "node-timeout",
      degraded: true,
    });

    const recovery = deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: true,
      retryAfterMs: 5000,
    });

    expect(recovery.retry.retryEligible).toBeTrue();
    expect(recovery.retry.retrySafe).toBeTrue();
    expect(recovery.retry.retryMode).toBe(ImageManipulationRetryModes.automatic);
    expect(recovery.retry.retryAfterMs).toBe(5000);
    expect(recovery.recoveryAction.kind).toBe(ImageManipulationRecoveryActionHintKinds.retryAutomatic);
    expect(recovery.escalation.required).toBeFalse();
  });

  it("classifies backend pending-recovery states as backend-recovery-pending with escalation", () => {
    const classification = createImageManipulationIssueClassification({
      layer: ImageManipulationIssueLayers.resultCollection,
      kind: ImageManipulationIssueKinds.operational,
      summaryCategory: ImageManipulationFailureSummaryCategories.output,
      disposition: ImageManipulationFailureDispositions.retryable,
      reason: "preview-pending",
      degraded: true,
    });

    const recovery = deriveImageManipulationRetryRecoveryContractFromClassification({
      classification,
      retryable: true,
      resilienceState: ImageManipulationResilienceStateKinds.pendingRecovery,
    });

    expect(recovery.recoveryAction.kind).toBe(ImageManipulationRecoveryActionHintKinds.backendRecoveryPending);
    expect(recovery.recoveryAction.backendRecoveryPending).toBeTrue();
    expect(recovery.escalation.category).toBe(ImageManipulationEscalationCategories.operator);
    expect(recovery.escalation.required).toBeTrue();
  });

  it("derives admin escalation from unavailable platform-repair resilience condition", () => {
    const condition = createImageManipulationResilienceCondition({
      code: "backend-unavailable",
      scope: ImageManipulationResilienceScopes.executionAvailability,
      state: ImageManipulationResilienceStateKinds.unavailable,
      summary: "Backend remains unavailable until platform repair completes.",
      observedAt: "2026-04-08T13:45:00.000Z",
      recovery: {
        kind: "platform-repair",
        retryable: false,
        blocking: true,
      },
    });

    const recovery = deriveImageManipulationRetryRecoveryContractFromResilienceCondition(condition);
    expect(recovery.recoveryAction.terminalNotRetryable).toBeTrue();
    expect(recovery.escalation.category).toBe(ImageManipulationEscalationCategories.admin);
    expect(recovery.escalation.required).toBeTrue();
  });

  it("derives retry/recovery advice from top snapshot condition", () => {
    const snapshot = createImageManipulationResilienceSnapshot({
      observedAt: "2026-04-08T13:50:00.000Z",
      conditions: [createImageManipulationResilienceCondition({
        code: "preview-pending",
        scope: ImageManipulationResilienceScopes.previewReadiness,
        state: ImageManipulationResilienceStateKinds.pendingRecovery,
        summary: "Result previews are still rendering.",
        observedAt: "2026-04-08T13:50:00.000Z",
      })],
    });

    const recovery = deriveImageManipulationRetryRecoveryContractFromResilienceSnapshot(snapshot);
    expect(recovery?.recoveryAction.kind).toBe(ImageManipulationRecoveryActionHintKinds.backendRecoveryPending);
  });
});
