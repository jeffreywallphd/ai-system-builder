import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeReadinessValidationService, ValidateRuntimeReadinessBindingUseCase } from "../index";

const workspaceId = "workspace.main" as never;
const readinessBindingId = "readiness.binding.1" as never;
const compositionPlanId = "composition.plan.1" as never;

const makeBinding = (): any => ({
  readinessBindingId, targetWorkspaceId: workspaceId, compositionPlanId, status: "draft", requirements: [
    { requirementId: "runtime.requirement.1", targetWorkspaceId: workspaceId, compositionPlanId, capabilityKind: "model", capabilityKey: "model", isRequired: true, label: "Model", diagnostics: [], blockers: [] },
  ],
  providerCandidates: [{ providerCandidateId: "runtime.provider-candidate.1", providerKind: "manual", inventorySourceId: "runtime.inventory-source.1", capabilities: [{ capabilityId: "runtime.capability.1", capabilityKind: "model", capabilityKey: "model", label: "model", availabilityStatus: "available", diagnostics: [], blockers: [] }], availabilityStatus: "available", displayLabel: "provider", diagnostics: [], blockers: [] }],
  bindingCandidates: [{ bindingCandidateId: "runtime.binding-candidate.1", targetWorkspaceId: workspaceId, requirementId: "runtime.requirement.1", providerCandidateId: "runtime.provider-candidate.1", capabilityId: "runtime.capability.1", matchStatus: "matched", diagnostics: [], blockers: [] }],
  bindings: [{ bindingId: "runtime.binding.1", targetWorkspaceId: workspaceId, readinessBindingId, requirementId: "runtime.requirement.1", selectedProviderCandidateId: "runtime.provider-candidate.1", selectedCapabilityId: "runtime.capability.1", status: "selected", diagnostics: [], blockers: [], provenance: [], createdAt: "2026-05-21T00:00:00.000Z", updatedAt: "2026-05-21T00:00:00.000Z" }], blockers: [], diagnostics: [], provenance: [], createdAt: "2026-05-21T00:00:00.000Z", updatedAt: "2026-05-21T00:00:00.000Z",
});

test("validates readiness binding to ready-for-setup", async () => {
  const saved: any[] = [];
  const useCase = new ValidateRuntimeReadinessBindingUseCase({
    bindingRepository: { readRuntimeReadinessBindingRecord: async () => makeBinding(), saveRuntimeReadinessBindingRecord: async (record: any) => (saved.push(record), record) } as any,
    validationService: new RuntimeReadinessValidationService(),
    now: () => "2026-05-21T01:00:00.000Z",
  });
  const result = await useCase.execute({ targetWorkspaceId: workspaceId, readinessBindingId } as any);
  assert.equal(result.status, "success");
  assert.equal(result.value.status, "ready-for-setup");
  assert.equal(result.value.updatedAt, "2026-05-21T01:00:00.000Z");
  assert.equal(saved.length, 1);
});

test("returns not-found for missing binding", async () => {
  const useCase = new ValidateRuntimeReadinessBindingUseCase({ bindingRepository: { readRuntimeReadinessBindingRecord: async () => undefined, saveRuntimeReadinessBindingRecord: async (record: any) => record } as any, validationService: new RuntimeReadinessValidationService() });
  const result = await useCase.execute({ targetWorkspaceId: workspaceId, readinessBindingId } as any);
  assert.equal(result.status, "failure");
  assert.equal(result.failure.kind, "not-found");
});

test("maps unavailable provider to provider-unavailable", () => {
  const service = new RuntimeReadinessValidationService();
  const binding = makeBinding();
  binding.providerCandidates[0].availabilityStatus = "unavailable";
  const result = service.validate(binding, workspaceId);
  assert.equal(result.status, "provider-unavailable");
});

test("missing required capability maps to missing-requirements", () => {
  const service = new RuntimeReadinessValidationService();
  const binding = makeBinding();
  binding.bindingCandidates = [];
  binding.bindings = [];
  const result = service.validate(binding, workspaceId);
  assert.equal(result.status, "missing-requirements");
});
