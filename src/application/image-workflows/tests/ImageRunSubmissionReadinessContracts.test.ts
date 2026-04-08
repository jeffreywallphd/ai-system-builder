import { describe, expect, it } from "bun:test";
import {
  ImageRunSubmissionBackendAdapterHealthStates,
  ImageRunSubmissionReadinessIssueCategories,
  ImageRunSubmissionReadinessIssueSeverities,
  ImageRunSubmissionReadinessStates,
  buildImageRunSubmissionReadinessResult,
} from "../ImageRunSubmissionReadinessContracts";

function createBaseInput() {
  return Object.freeze({
    checkedAt: "2026-04-08T19:00:00.000Z",
    assetBinding: Object.freeze({
      complete: true,
      missingInputBindingIds: Object.freeze([]),
      missingOutputBindingIds: Object.freeze([]),
      unresolvedAssetReferences: Object.freeze([]),
    }),
    workflowValidity: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
    }),
    systemValidity: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
    }),
    backendReadinessDependency: Object.freeze({
      adapterHealth: ImageRunSubmissionBackendAdapterHealthStates.healthy,
      ready: true,
      issues: Object.freeze([]),
    }),
    compatibility: Object.freeze({
      compatible: true,
      issues: Object.freeze([]),
    }),
  });
}

describe("ImageRunSubmissionReadinessContracts", () => {
  it("reports blocked readiness when blocking issues exist", () => {
    const result = buildImageRunSubmissionReadinessResult({
      ...createBaseInput(),
      issues: Object.freeze([Object.freeze({
        code: "policy-denied",
        summary: "Run submission policy denied this operation.",
        category: ImageRunSubmissionReadinessIssueCategories.policyDenial,
        severity: ImageRunSubmissionReadinessIssueSeverities.error,
        blocking: true,
      })]),
      policyDenials: Object.freeze([Object.freeze({
        policyId: "policy:run-submission",
        code: "policy-denied",
        summary: "Policy denied submission for this actor.",
      })]),
    });

    expect(result.state).toBe(ImageRunSubmissionReadinessStates.blocked);
    expect(result.readyForQueueing).toBeFalse();
    expect(result.blockingIssues).toHaveLength(1);
    expect(result.policyDenials).toHaveLength(1);
  });

  it("reports advisory readiness when only non-blocking issues exist", () => {
    const result = buildImageRunSubmissionReadinessResult({
      ...createBaseInput(),
      issues: Object.freeze([Object.freeze({
        code: "backend-capability-degraded",
        summary: "Execution backend capability is degraded but still available.",
        category: ImageRunSubmissionReadinessIssueCategories.backendReadinessDependency,
        severity: ImageRunSubmissionReadinessIssueSeverities.warning,
        blocking: false,
      })]),
    });

    expect(result.state).toBe(ImageRunSubmissionReadinessStates.advisory);
    expect(result.readyForQueueing).toBeTrue();
    expect(result.advisoryIssues).toHaveLength(1);
  });

  it("reports ready readiness when no issues exist", () => {
    const result = buildImageRunSubmissionReadinessResult({
      ...createBaseInput(),
      issues: Object.freeze([]),
    });

    expect(result.state).toBe(ImageRunSubmissionReadinessStates.ready);
    expect(result.readyForQueueing).toBeTrue();
    expect(result.summary).toContain("ready for queue admission");
  });
});
