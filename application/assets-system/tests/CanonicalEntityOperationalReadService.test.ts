import { describe, expect, it } from "bun:test";
import { CanonicalEntityOperationalReadService } from "../CanonicalEntityOperationalReadService";

describe("CanonicalEntityOperationalReadService", () => {
  it("returns explicit fallback when resolver is unavailable", async () => {
    const summary = await new CanonicalEntityOperationalReadService().resolveSummary({
      entityType: "workflow-definition",
      entityId: "wf-1",
      fallbackWhenUnavailable: "Canonical resolver missing.",
    });
    expect(summary.preferred).toBeFalse();
    expect(summary.fallbackReason).toBe("Canonical resolver missing.");
  });

  it("projects dependency-state and provenance from canonical resolver", async () => {
    const summary = await new CanonicalEntityOperationalReadService({
      resolve: async () => ({
        preferred: true,
        assetId: "workflow-definition:wf-1",
        pinnedVersionId: "wf:v1",
        latestVersionId: "wf:v2",
        provenance: {
          directUpstreamCount: 1,
          directDownstreamCount: 2,
          producingTransformationCount: 1,
          lineageConfidence: "partial",
        },
        dependencyState: {
          versionId: "wf:v2",
          state: "impacted",
          lineageConfidence: "partial",
          reasons: ["upstream-changed"],
          impactedByUpstreamVersionIds: ["upstream:v2"],
          staleBecauseUpstreamAdvanced: [],
          nextActions: ["Refresh dependency state after upstream changes and review downstream exposure."],
        },
      }),
    } as any).resolveSummary({
      entityType: "workflow-definition",
      entityId: "wf-1",
      fallbackWhenUnavailable: "missing",
    });
    expect(summary.preferred).toBeTrue();
    expect(summary.dependencyState?.state).toBe("impacted");
    expect(summary.provenance?.lineageConfidence).toBe("partial");
  });
});
