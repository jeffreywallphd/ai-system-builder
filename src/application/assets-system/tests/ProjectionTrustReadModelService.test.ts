import { describe, expect, it } from "bun:test";
import { ProjectionTrustReadModelService } from "../ProjectionTrustReadModelService";

describe("ProjectionTrustReadModelService", () => {
  it("builds trusted summaries with no remediation", () => {
    const service = new ProjectionTrustReadModelService();
    const summary = service.summarize({
      assetId: "workflow-definition:w1",
      matched: true,
      trust: {
        state: "trusted",
        explanation: "all checks matched",
        recommendedActions: ["none"],
      },
      projectionSummary: { edgeCount: 3, scopedVersionCount: 2 },
      mismatches: [],
      checks: [{ code: "EDGE_COUNT", matched: true, message: "ok" }],
    });

    expect(summary.trustState).toBe("trusted");
    expect(summary.comparison?.mismatchedScopedVersions).toBe(0);
    expect(summary.remediation?.status).toBe("none-needed");
  });

  it("builds mismatch summaries with replay remediation hints", () => {
    const service = new ProjectionTrustReadModelService();
    const summary = service.summarize({
      assetId: "dataset-version:d1:v1",
      matched: false,
      trust: {
        state: "mismatch-detected",
        explanation: "mismatch",
        recommendedActions: ["Replay", "Re-verify"],
      },
      projectionSummary: { edgeCount: 1, scopedVersionCount: 1 },
      mismatches: [{
        versionId: "v1",
        missingUpstreamVersionIds: ["u1"],
        unexpectedUpstreamVersionIds: [],
        missingDownstreamVersionIds: [],
        unexpectedDownstreamVersionIds: ["d1"],
      }],
      checks: [{ code: "SCOPE", matched: false, message: "bad" }],
    });

    expect(summary.failedChecks[0]).toContain("SCOPE");
    expect(summary.comparison?.missingEdgeReferences).toBe(1);
    expect(summary.comparison?.unexpectedEdgeReferences).toBe(1);
    expect(summary.remediation?.status).toBe("replay-recommended");
  });
});
