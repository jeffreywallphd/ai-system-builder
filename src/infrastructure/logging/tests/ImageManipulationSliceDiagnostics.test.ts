import { describe, expect, it } from "bun:test";
import {
  createImageManipulationSliceCorrelation,
  deriveImageManipulationResilienceDiagnostics,
} from "../ImageManipulationSliceDiagnostics";

describe("ImageManipulationSliceDiagnostics", () => {
  it("normalizes correlation identifiers and removes blank values", () => {
    const correlation = createImageManipulationSliceCorrelation({
      requestId: " req-1 ",
      correlationId: "corr-1",
      workspaceId: "workspace-1",
      runId: "run-1",
      resultAssetId: "   ",
      operationKey: "op-1",
    });

    expect(correlation.requestId).toBe("req-1");
    expect(correlation.resultAssetId).toBeUndefined();
    expect(correlation.operationKey).toBe("op-1");
  });

  it("derives resilience diagnostics from normalized failure details envelope", () => {
    const diagnostics = deriveImageManipulationResilienceDiagnostics({
      defaultCode: "fallback-code",
      defaultSummary: "fallback-summary",
      details: Object.freeze({
        imageManipulationFailure: Object.freeze({
          classification: Object.freeze({
            issueCode: "im.preview.operational.preview-persistence-failed",
            reason: "Preview persistence failed.",
            kind: "operational",
            degraded: true,
            summaryCategory: "output",
          }),
          recovery: Object.freeze({
            retryEligible: true,
            retryAfterMs: 1500,
          }),
          resilience: Object.freeze({
            scope: "preview-generation",
            state: "preview-persistence-failed",
            recoveryKind: "automatic-retry",
          }),
        }),
      }),
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe("im.preview.operational.preview-persistence-failed");
    expect(diagnostics[0]?.category).toBe("degraded");
    expect(diagnostics[0]?.retryable).toBeTrue();
    expect(diagnostics[0]?.scope).toBe("preview-generation");
    expect(diagnostics[0]?.state).toBe("preview-persistence-failed");
  });
});
