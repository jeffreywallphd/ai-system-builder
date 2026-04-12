import { describe, expect, it } from "bun:test";
import {
  ImageManipulationResilienceDurabilityClasses,
  ImageManipulationResilienceScopes,
  ImageManipulationResilienceStateKinds,
  createImageManipulationResilienceCondition,
  createImageManipulationResilienceSnapshot,
  toImageManipulationResilienceApiProjection,
  toImageManipulationResilienceMonitoringProjection,
} from "../ImageManipulationResilienceStateContracts";

describe("ImageManipulationResilienceStateContracts", () => {
  it("models workflow-valid but no-eligible-node as blocked while preserving authoritative truth", () => {
    const snapshot = createImageManipulationResilienceSnapshot({
      observedAt: "2026-04-08T12:00:00.000Z",
      conditions: [createImageManipulationResilienceCondition({
        code: "execution-node-no-eligible-match",
        scope: ImageManipulationResilienceScopes.nodeEligibility,
        state: ImageManipulationResilienceStateKinds.blocked,
        summary: "Workflow is valid but no eligible execution node is currently routable.",
        observedAt: "2026-04-08T12:00:00.000Z",
        durability: ImageManipulationResilienceDurabilityClasses.temporary,
      })],
    });

    expect(snapshot.state).toBe(ImageManipulationResilienceStateKinds.blocked);
    expect(snapshot.usable).toBeFalse();
    expect(snapshot.blockedConditions[0]?.code).toBe("execution-node-no-eligible-match");
  });

  it("models completed run with preview pending as partial pending-recovery", () => {
    const snapshot = createImageManipulationResilienceSnapshot({
      observedAt: "2026-04-08T12:10:00.000Z",
      conditions: [createImageManipulationResilienceCondition({
        code: "result-preview-pending",
        scope: ImageManipulationResilienceScopes.previewReadiness,
        state: ImageManipulationResilienceStateKinds.pendingRecovery,
        summary: "Run completed but preview derivatives are still being generated.",
        observedAt: "2026-04-08T12:10:00.000Z",
        durability: ImageManipulationResilienceDurabilityClasses.temporary,
      })],
    });

    expect(snapshot.state).toBe(ImageManipulationResilienceStateKinds.pendingRecovery);
    expect(snapshot.usable).toBeTrue();
    expect(snapshot.partiallyUsable).toBeTrue();
  });

  it("distinguishes temporary retrieval unavailability from durable breakage", () => {
    const temporary = createImageManipulationResilienceSnapshot({
      observedAt: "2026-04-08T12:20:00.000Z",
      conditions: [createImageManipulationResilienceCondition({
        code: "asset-retrieval-temporarily-unavailable",
        scope: ImageManipulationResilienceScopes.assetRetrieval,
        state: ImageManipulationResilienceStateKinds.temporarilyUnavailable,
        summary: "Asset exists but temporary retrieval failure prevents access.",
        observedAt: "2026-04-08T12:20:00.000Z",
        durability: ImageManipulationResilienceDurabilityClasses.temporary,
      })],
    });
    const persistent = createImageManipulationResilienceSnapshot({
      observedAt: "2026-04-08T12:21:00.000Z",
      conditions: [createImageManipulationResilienceCondition({
        code: "asset-retrieval-unavailable",
        scope: ImageManipulationResilienceScopes.assetRetrieval,
        state: ImageManipulationResilienceStateKinds.unavailable,
        summary: "Asset retrieval is unavailable until platform repair completes.",
        observedAt: "2026-04-08T12:21:00.000Z",
        durability: ImageManipulationResilienceDurabilityClasses.persistent,
      })],
    });

    expect(temporary.state).toBe(ImageManipulationResilienceStateKinds.temporarilyUnavailable);
    expect(temporary.conditions[0]?.durability).toBe("temporary");
    expect(persistent.state).toBe(ImageManipulationResilienceStateKinds.unavailable);
    expect(persistent.conditions[0]?.durability).toBe("persistent");
  });

  it("projects backend-reachable degraded status to API and monitoring consumers", () => {
    const snapshot = createImageManipulationResilienceSnapshot({
      observedAt: "2026-04-08T12:30:00.000Z",
      conditions: [createImageManipulationResilienceCondition({
        code: "backend-degraded",
        scope: ImageManipulationResilienceScopes.executionAvailability,
        state: ImageManipulationResilienceStateKinds.degraded,
        summary: "Backend is reachable but degraded.",
        observedAt: "2026-04-08T12:30:00.000Z",
      })],
    });
    const api = toImageManipulationResilienceApiProjection(snapshot);
    const monitoring = toImageManipulationResilienceMonitoringProjection(snapshot);

    expect(api.state).toBe(ImageManipulationResilienceStateKinds.degraded);
    expect(api.usable).toBeTrue();
    expect(api.degradedConditionCodes).toContain("backend-degraded");
    expect(monitoring.conditionCount).toBe(1);
    expect(monitoring.tags).toContain("execution-availability:degraded:backend-degraded");
  });
});
