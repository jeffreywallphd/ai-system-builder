import test from "node:test";
import assert from "node:assert/strict";
import { ExecutionPlanProviderPlanningService, ExecutionPlanProviderPlannerRegistryService } from "../execution-plan-provider-planning.service";

const mkStep = (kind: any, summary = "safe summary") => ({ id: "es_1", sourceCompositionPlanId: "acp_1", kind, status: "planned", label: "step", summary, requiredAdapterReferenceIds: [], inputIds: [], outputIds: [], dependencyIds: [], safetyGateIds: [], blockers: [], diagnostics: [] });

test("registry deterministically selects image planner", () => {
  const registry = new ExecutionPlanProviderPlannerRegistryService();
  const selectedA = registry.select({ planId: "ep_1", sourceRuntimeReadinessBindingId: "rrb_1", step: mkStep("generate-image"), createAdapterReferenceId: () => "ear_1", createSafetyGateId: () => "esg_1" });
  const selectedB = registry.select({ planId: "ep_1", sourceRuntimeReadinessBindingId: "rrb_1", step: mkStep("generate-image"), createAdapterReferenceId: () => "ear_2", createSafetyGateId: () => "esg_2" });
  assert.equal(selectedA.constructor.name, selectedB.constructor.name);
});

test("provider planning creates adapters and gates for each step kind", () => {
  const service = new ExecutionPlanProviderPlanningService();
  const result = service.plan({
    planId: "ep_1",
    sourceRuntimeReadinessBindingId: "rrb_1",
    steps: [mkStep("generate-image"), mkStep("generate-text"), mkStep("embed-content"), mkStep("store-artifact"), mkStep("call-api"), mkStep("manual-review")],
    createAdapterReferenceId: () => "ear_1",
    createSafetyGateId: () => "esg_1"
  });
  assert.equal(result.adapterReferences.length >= 6, true);
  assert.equal(result.safetyGates.length >= 6, true);
  assert.equal(result.steps.some((s) => s.status === "needs-review"), true);
});

test("image planner emits provider setup blocker for unknown provider", () => {
  const service = new ExecutionPlanProviderPlanningService();
  const result = service.plan({ planId: "ep_1", sourceRuntimeReadinessBindingId: "rrb_1", steps: [mkStep("generate-image", "unknown-provider")], createAdapterReferenceId: () => "ear_1", createSafetyGateId: () => "esg_1" });
  assert.equal(result.blockers.some((b) => b.code === "execution-plan-provider-setup-required"), true);
  assert.equal(JSON.stringify(result).includes("workflow"), false);
});
