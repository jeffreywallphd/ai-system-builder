import assert from "node:assert/strict";
import { describe, it } from "../../../testing/node-test";
import { createWorkspaceId } from "../../workspace";
import * as contracts from "..";

describe("asset composition contracts", () => {
  const ws = createWorkspaceId("workspace.alpha");
  it("normalizes ids and rejects unsafe values without echo", () => {
    assert.equal(contracts.normalizeAssetCompositionPlanId("plan.alpha"), "plan.alpha");
    for (const bad of ["", " ", "../a", "https://x", "ghp_secret"]) {
      assert.throws(() => contracts.normalizeAssetCompositionNodeId(bad), (e: unknown) => e instanceof Error && !e.message.includes(bad));
    }
  });
  it("normalizes statuses roles and relationship kinds", () => {
    assert.equal(contracts.normalizeAssetCompositionPlanStatus(" VALID "), "valid");
    assert.equal(contracts.normalizeAssetCompositionNodeStatus("planned"), "planned");
    assert.equal(contracts.normalizeAssetCompositionCompatibilityStatus("compatible"), "compatible");
    assert.equal(contracts.normalizeAssetCompositionNodeRole("model"), "model");
    assert.equal(contracts.normalizeAssetCompositionRelationshipKind("depends-on"), "depends-on");
    assert.throws(() => contracts.normalizeAssetCompositionPlanStatus("execution-ready"));
    assert.throws(() => contracts.normalizeAssetCompositionNodeRole("execution-engine"));
    assert.throws(() => contracts.normalizeAssetCompositionRelationshipKind("executes"));
  });
  it("normalizes capabilities and rejects unsafe metadata", () => {
    const cap = contracts.normalizeAssetCompositionCapability({ kind: "text-input", key: "input.prompt", label: "Prompt", direction: "required", safeMetadata: { format: "plain" } });
    assert.equal(cap.kind, "text-input");
    assert.throws(() => contracts.normalizeAssetCompositionCapability({ kind: "text-input", key: "cmd", safeMetadata: { command: "rm -rf" } as any }));
  });
  it("requires workspace and projection in selected projection refs", () => {
    const ref = contracts.normalizeSelectedAssetProjectionReference({ targetWorkspaceId: ws, projectionId: "projection.alpha" as any });
    assert.equal(ref.targetWorkspaceId, ws);
    assert.throws(() => contracts.normalizeSelectedAssetProjectionReference({ targetWorkspaceId: " " as any, projectionId: "projection.alpha" as any }));
  });
  it("normalizes plan and commands; result shapes discriminated", () => {
    const plan = contracts.normalizeAssetCompositionPlan({ planId: "plan.alpha" as any, targetWorkspaceId: ws, name: "Plan", status: "draft", selectedProjections: [{ targetWorkspaceId: ws, projectionId: "projection.alpha" as any }], nodes: [], relationships: [], compatibilityDiagnostics: [], blockers: [], planningSummary: { totalNodes: 0, compatibleNodeCount: 0, blockedNodeCount: 0, conflictedNodeCount: 0, missingDependencyCount: 0, staleProjectionCount: 0, unsupportedCount: 0, totalRelationships: 0, compatibleRelationshipCount: 0, blockedRelationshipCount: 0, planningReadiness: "needs-attention" }, provenance: [], createdAt: "2026-05-20T00:00:00.000Z", updatedAt: "2026-05-20T00:00:00.000Z" });
    assert.equal(plan.status, "draft");
    const c = contracts.normalizeConnectCompositionNodesCommand({ targetWorkspaceId: ws, planId: "plan.alpha" as any, sourceNodeId: "node.a" as any, targetNodeId: "node.b" as any, relationshipKind: "depends-on" });
    assert.equal(c.sourceNodeId, "node.a");
    const ok: contracts.CreateAssetCompositionPlanResult = { status: "success", value: plan };
    const fail: contracts.CreateAssetCompositionPlanResult = { status: "failure", failure: { kind: "validation", code: "asset-composition-workspace-required", diagnostics: [{ code: "asset-composition-workspace-required", severity: "error", message: "/tmp/a" }] } };
    assert.equal(ok.status, "success");
    assert.equal(contracts.normalizeAssetCompositionDiagnostic(fail.failure.diagnostics[0]).message.includes("/tmp"), false);
  });
  it("exports from family and root barrel", async () => {
    assert.equal(typeof contracts.normalizeAssetCompositionPlanId, "function");
    const root = await import("../../index");
    assert.equal(typeof root.assetComposition.normalizeAssetCompositionPlanId, "function");
  });
});
