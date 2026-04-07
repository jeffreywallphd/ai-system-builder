import { describe, expect, it } from "bun:test";
import type { IWorkflowRepository } from "../../ports/interfaces/IWorkflowRepository";
import type { IWorkflowExecutor } from "../../ports/interfaces/IWorkflowExecutor";
import type { IWorkflowValidator } from "@domain/services/interfaces/IWorkflowValidator";
import { makeWorkflow } from "@domain/services/tests/testUtils";
import { makeWorkflowExecutor, makeWorkflowRepository, makeWorkflowValidator } from "./testUtils";

describe("application/workflows contracts", () => {
  it("workflow ports and services satisfy contracts", async () => {
    const repo: IWorkflowRepository = makeWorkflowRepository();
    const exec: IWorkflowExecutor = makeWorkflowExecutor();
    const validator: IWorkflowValidator = makeWorkflowValidator();

    expect(await repo.list()).toEqual([]);
    expect(exec.canExecute({ workflow: makeWorkflow({}) })).toBeTrue();
    expect(validator.validateWorkflow(makeWorkflow({})).isValid).toBeTrue();
  });
});

