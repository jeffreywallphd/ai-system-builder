import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinalizeGeneratedOutputCommand, RegisterResourceBackedViewCommand } from "../../../../contracts/asset";
import { validateFinalizeGeneratedOutputMutationGuard, validateRegisterResourceBackedViewMutationGuard } from "../asset-mutation-guard.service";

function command(overrides: Partial<RegisterResourceBackedViewCommand> = {}): RegisterResourceBackedViewCommand {
  return {
    operation: "asset.register-resource-backed-view",
    viewId: "view.one",
    approval: { userConfirmed: true, confirmationKind: "register-resource-backed-view" },
    actor: { initiatedBy: "human" },
    ...overrides,
  };
}

function finalizeCommand(overrides: Partial<FinalizeGeneratedOutputCommand> = {}): FinalizeGeneratedOutputCommand {
  return {
    operation: "asset.finalize-generated-output",
    viewId: "view.generated",
    approval: { userConfirmed: true, confirmationKind: "finalize-generated-output", allowFilesystemWrite: true },
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

  it("requires explicit finalization confirmation and filesystem write approval", () => {
    assert.equal(validateFinalizeGeneratedOutputMutationGuard(finalizeCommand()), undefined);
    assert.equal(validateFinalizeGeneratedOutputMutationGuard(finalizeCommand({ approval: { userConfirmed: false, confirmationKind: "finalize-generated-output", allowFilesystemWrite: true } }))?.code, "approval-required");
    assert.equal(validateFinalizeGeneratedOutputMutationGuard(finalizeCommand({ approval: { userConfirmed: true, confirmationKind: "register-resource-backed-view", allowFilesystemWrite: true } }))?.code, "validation");
    assert.equal(validateFinalizeGeneratedOutputMutationGuard(finalizeCommand({ approval: { userConfirmed: true, confirmationKind: "finalize-generated-output" } }))?.code, "permission");
    assert.equal(validateFinalizeGeneratedOutputMutationGuard(finalizeCommand({ approval: { userConfirmed: true, confirmationKind: "finalize-generated-output", allowFilesystemWrite: true, allowNetworkAccess: true } }))?.code, "validation");
    assert.equal(validateFinalizeGeneratedOutputMutationGuard(finalizeCommand({ approval: { userConfirmed: true, confirmationKind: "finalize-generated-output", allowFilesystemWrite: true, allowCredentialUse: true } }))?.code, "validation");
  });
});
