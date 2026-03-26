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
    expect(summary.operationalStatus?.trust).toBe("attention-needed");
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
        contract: {
          version: "1.0.0",
          input: { kind: "json-schema" },
          output: { kind: "json-schema" },
          parameters: [],
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
    expect(summary.operationalStatus?.trust).toBe("attention-needed");
    expect(summary.contract?.version).toBe("1.0.0");
  });

  it("returns identity-backed canonical summary when resolver is unavailable", async () => {
    const summary = await new CanonicalEntityOperationalReadService(
      undefined,
      {
        resolveIdentity: async () => ({
          entityType: "installed-model",
          entityId: "model-1",
          assetId: "installed-model:model-1",
          latestVersionId: "model:v1",
          updatedAt: new Date("2026-03-24T00:00:00.000Z"),
        }),
        resolveLatestVersionId: async () => "model:v1",
      } as any,
    ).resolveSummary({
      entityType: "installed-model",
      entityId: "model-1",
      fallbackWhenUnavailable: "missing",
    });
    expect(summary.preferred).toBeTrue();
    expect(summary.assetId).toBe("installed-model:model-1");
    expect(summary.fallbackReason).toContain("identity-only");
    expect(summary.operationalStatus?.trust).toBe("attention-needed");
  });
});
