import { describe, expect, it } from "bun:test";
import { CreateWorkflowUseCase } from "../CreateWorkflowUseCase";
import { SaveWorkflowUseCase } from "../SaveWorkflowUseCase";
import { LoadWorkflowUseCase } from "../LoadWorkflowUseCase";
import { ExecuteWorkflowUseCase } from "../ExecuteWorkflowUseCase";
import { ValidateWorkflowUseCase } from "../ValidateWorkflowUseCase";
import { makeWorkflowExecutor, makeWorkflowRepository, makeWorkflowValidator } from "./testUtils";

describe("application/workflows interactions", () => {
  it("create -> save -> load -> validate -> execute flow", async () => {
    let persisted: any;
    const repo = makeWorkflowRepository({
      save: async (wf) => (persisted = wf, wf),
      load: async () => persisted,
    });
    const validator = makeWorkflowValidator();

    const created = new CreateWorkflowUseCase(() => "flow").execute({ metadata: { name: "Flow" } });
    await new SaveWorkflowUseCase(repo, validator).execute({ workflow: created.workflow });
    const loaded = await new LoadWorkflowUseCase(repo, validator).execute({ workflowId: "flow" });
    const validated = new ValidateWorkflowUseCase(validator).execute({ workflow: loaded.workflow! });
    const executed = await new ExecuteWorkflowUseCase(makeWorkflowExecutor(), validator).execute({ workflow: validated.workflow });

    expect(loaded.workflow?.id).toBe("flow");
    expect(validated.validation.isValid).toBeTrue();
    expect(executed.result.status).toBe("completed");
  });
});
