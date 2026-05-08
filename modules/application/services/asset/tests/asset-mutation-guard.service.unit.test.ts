import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RegisterResourceBackedViewCommand } from "../../../../contracts/asset";
import { validateRegisterResourceBackedViewMutationGuard } from "../asset-mutation-guard.service";

function command(overrides: Partial<RegisterResourceBackedViewCommand> = {}): RegisterResourceBackedViewCommand {
  return {
    operation: "asset.register-resource-backed-view",
    viewId: "view.one",
    approval: { userConfirmed: true, confirmationKind: "register-resource-backed-view" },
    actor: { initiatedBy: "human" },
    ...overrides,
  };
}

describe("asset mutation guard", () => {
  it("accepts explicit resource-backed registration approval", () => {
    assert.equal(validateRegisterResourceBackedViewMutationGuard(command()), undefined);
  });

  it("rejects missing confirmation and access flags for simple registration", () => {
    assert.equal(validateRegisterResourceBackedViewMutationGuard(command({ approval: { userConfirmed: false, confirmationKind: "register-resource-backed-view" } }))?.code, "approval-required");
    assert.equal(validateRegisterResourceBackedViewMutationGuard(command({ approval: { userConfirmed: true, confirmationKind: "register-resource-backed-view", allowFilesystemWrite: true } }))?.code, "validation");
    assert.equal(validateRegisterResourceBackedViewMutationGuard(command({ approval: { userConfirmed: true, confirmationKind: "import-external-object" } }))?.code, "validation");
  });
});
