import { describe, expect, it } from "bun:test";
import { createCompositionTaxonomyDescriptor, TaxonomyBehaviorKinds, TaxonomySemanticRoles, TaxonomyStructuralKinds } from "../../../domain/taxonomy/CompositionTaxonomy";
import { createStudioHandoffContract, StudioHandoffIntentKinds } from "../../../domain/studio-handoff/StudioHandoffContract";
import { createStudioHandoffContext } from "../../../domain/studio-handoff/StudioHandoffContext";
import type { PersistedStudioHandoffRecord } from "../StudioHandoffPersistenceService";
import { StudioHandoffRetryDecisionKinds, StudioHandoffRetryService, StudioHandoffRetryableFailureClassifier } from "../StudioHandoffRetryService";

function createFailedRecord(params: {
  readonly handoffId: string;
  readonly issueCodes: ReadonlyArray<string>;
}): PersistedStudioHandoffRecord {
  return Object.freeze({
    handoffId: params.handoffId,
    sourceStudioId: "dataset-studio-default",
    sourceStudioType: "dataset-studio",
    targetStudioId: "workflow-studio-default",
    targetStudioType: "workflow-studio",
    authoritativeAsset: {
      assetId: "asset:dataset",
      versionId: "asset:dataset:v1",
    },
    bundledAssets: [{
      role: "primary",
      assetId: "asset:dataset",
      versionId: "asset:dataset:v1",
    }],
    context: {
      intentKind: StudioHandoffIntentKinds.authoringContinuation,
      sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", relation: "primary" }],
      prefillKeys: [],
    },
    orchestration: {
      status: "failed",
      issueCodes: Object.freeze([...params.issueCodes]),
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

function createBasisHandoff(handoffId: string, versionId: string) {
  const taxonomy = createCompositionTaxonomyDescriptor({
    structuralKind: TaxonomyStructuralKinds.atomic,
    semanticRole: TaxonomySemanticRoles.dataset,
    behaviorKind: TaxonomyBehaviorKinds.none,
  });
  return createStudioHandoffContract({
    id: handoffId,
    source: { studioId: "dataset-studio-default", studioType: "dataset-studio" },
    target: { studioId: "workflow-studio-default", studioType: "workflow-studio" },
    payload: {
      assetId: "asset:dataset",
      versionId,
      taxonomy,
      targetInputContract: { contractId: "workflow-default-input" },
    },
    intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
  });
}

describe("StudioHandoffRetryService", () => {
  it("retries retryable failed handoffs and persists explicit retry linkage", async () => {
    const failed = createFailedRecord({ handoffId: "handoff:failed", issueCodes: ["persistence-failed"] });
    const basis = createBasisHandoff("handoff:retry-1", "asset:dataset:v1");

    const persistedPrepared: PersistedStudioHandoffRecord[] = [];
    const service = new StudioHandoffRetryService(
      {
        async getByHandoffId() { return failed; },
      },
      {
        async persistPrepared(input) {
          const record = Object.freeze({
            ...failed,
            handoffId: input.preparation.handoff.id.value,
            orchestration: { ...failed.orchestration, status: "prepared" as const, issueCodes: [] },
            retryLink: input.retryLink,
          });
          persistedPrepared.push(record);
          return record;
        },
        async persistFailure() { throw new Error("not expected"); },
      },
      {
        orchestrate() {
          return Object.freeze({
            ok: true,
            preparation: {
              handoff: basis,
              context: createStudioHandoffContext({
                sourceStudioId: "dataset-studio-default",
                sourceStudioType: "dataset-studio",
                targetStudioId: "workflow-studio-default",
                targetStudioType: "workflow-studio",
                intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
                sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v1", relation: "primary" }],
                initiatedAt: new Date(),
              }),
              sourceOutput: { kind: "atomic" } as never,
              compatibility: { compatible: true, targetStudioType: "workflow-studio", issues: [] },
              targetInput: { kind: "composite", sourceReferences: [] } as never,
            },
          });
        },
      },
    );

    const result = await service.retryFailedHandoff({
      handoffId: "handoff:failed",
      basisHandoff: basis,
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          taxonomy: basis.payload.taxonomy,
        },
      },
      targetCapabilities: [],
    });

    expect(result.allowed).toBeTrue();
    expect(result.decision.decision).toBe(StudioHandoffRetryDecisionKinds.retryable);
    expect(result.retryLink?.sourceHandoffId).toBe("handoff:failed");
    expect(result.retryLink?.targetHandoffId).toBe("handoff:retry-1");
    expect(persistedPrepared[0]?.retryLink?.attemptKind).toBe("retry");
  });

  it("rejects terminal failures with structured decision", async () => {
    const failed = createFailedRecord({ handoffId: "handoff:terminal", issueCodes: ["request-invalid"] });
    const basis = createBasisHandoff("handoff:retry-terminal", "asset:dataset:v1");

    const service = new StudioHandoffRetryService(
      { async getByHandoffId() { return failed; } },
      {
        async persistPrepared() { throw new Error("not expected"); },
        async persistFailure() { throw new Error("not expected"); },
      },
      {
        orchestrate() {
          return Object.freeze({ ok: true, preparation: undefined });
        },
      },
    );

    const result = await service.retryFailedHandoff({
      handoffId: "handoff:terminal",
      basisHandoff: basis,
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v1",
          taxonomy: basis.payload.taxonomy,
        },
      },
      targetCapabilities: [],
    });

    expect(result.allowed).toBeFalse();
    expect(result.decision.decision).toBe(StudioHandoffRetryDecisionKinds.terminal);
  });

  it("reconciles version-reference failures after bounded version/context changes", async () => {
    const failed = createFailedRecord({ handoffId: "handoff:bad-version", issueCodes: ["version-reference-invalid"] });
    const basis = createBasisHandoff("handoff:reconciled", "asset:dataset:v2");

    const persistedFailures: PersistedStudioHandoffRecord[] = [];
    const service = new StudioHandoffRetryService(
      { async getByHandoffId() { return failed; } },
      {
        async persistPrepared() { throw new Error("not expected"); },
        async persistFailure(input) {
          const record = Object.freeze({
            ...failed,
            handoffId: input.handoff.id.value,
            authoritativeAsset: { ...failed.authoritativeAsset, versionId: "asset:dataset:v2" },
            retryLink: input.retryLink,
          });
          persistedFailures.push(record);
          return record;
        },
      },
      {
        orchestrate() {
          return Object.freeze({
            ok: false,
            failure: {
              kind: "version-reference-failure",
              rejectionReason: "version-reference-rejected",
              stage: "input-adaptation",
              code: "input-adaptation-failed",
              message: "still invalid",
              issues: [{ code: "version-reference-invalid", message: "still invalid" }],
              context: { impactedAssets: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2" }] },
            },
          });
        },
      },
    );

    const result = await service.reconcileFailedHandoff({
      handoffId: "handoff:bad-version",
      basisHandoff: basis,
      contextOverride: createStudioHandoffContext({
        sourceStudioId: "dataset-studio-default",
        sourceStudioType: "dataset-studio",
        targetStudioId: "workflow-studio-default",
        targetStudioType: "workflow-studio",
        intent: { kind: StudioHandoffIntentKinds.authoringContinuation },
        sourceReferences: [{ assetId: "asset:dataset", versionId: "asset:dataset:v2", relation: "primary" }],
        initiatedAt: new Date(),
      }),
      sourceOutput: {
        sourceStudioType: "dataset-studio",
        sourceStudioId: "dataset-studio-default",
        authoritativeAsset: {
          assetId: "asset:dataset",
          versionId: "asset:dataset:v2",
          taxonomy: basis.payload.taxonomy,
        },
      },
      targetCapabilities: [],
    });

    expect(result.allowed).toBeTrue();
    expect(result.decision.decision).toBe(StudioHandoffRetryDecisionKinds.reconcilable);
    expect(result.retryLink?.attemptKind).toBe("reconciliation");
    expect(persistedFailures[0]?.retryLink?.sourceHandoffId).toBe("handoff:bad-version");
  });

  it("classifies grouped and system-of-systems failures as reconcilable", () => {
    const classifier = new StudioHandoffRetryableFailureClassifier();

    const grouped = classifier.classify({
      record: createFailedRecord({ handoffId: "handoff:grouped", issueCodes: ["bundle-asset-incompatible"] }),
      failure: {
        kind: "invalid-grouped-handoff",
        rejectionReason: "grouped-input-rejected",
        stage: "input-adaptation",
        code: "input-adaptation-failed",
        message: "grouped mismatch",
        issues: [{ code: "bundle-asset-incompatible", message: "grouped mismatch" }],
        context: { impactedAssets: [{ assetId: "asset:bundle", versionId: "asset:bundle:v1" }] },
      },
    });

    const system = classifier.classify({
      record: createFailedRecord({ handoffId: "handoff:system", issueCodes: ["taxonomy-incompatible"] }),
      failure: {
        kind: "system-of-systems-failure",
        rejectionReason: "system-of-systems-rejected",
        stage: "input-adaptation",
        code: "input-adaptation-failed",
        message: "system mismatch",
        issues: [{ code: "taxonomy-incompatible", message: "system mismatch" }],
        context: { impactedAssets: [{ assetId: "system:root", versionId: "system:root:v3", role: "system-component" }] },
      },
    });

    expect(grouped.decision).toBe(StudioHandoffRetryDecisionKinds.reconcilable);
    expect(system.decision).toBe(StudioHandoffRetryDecisionKinds.reconcilable);
  });
});
