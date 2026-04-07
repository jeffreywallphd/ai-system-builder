import { describe, expect, it } from "bun:test";
import { CreateWorkflowUseCase } from "../CreateWorkflowUseCase";
import { makeNode } from "@domain/services/tests/testUtils";

describe("CreateWorkflowUseCase", () => {
  it("creates workflow with defaults", () => {
    const result = new CreateWorkflowUseCase(() => "wf-id").execute({ metadata: { name: "Flow" } });
    expect(result.workflow.id).toBe("wf-id");
    expect(result.workflow.status).toBe("draft");
  });

  it("can validate on create", () => {
    const result = new CreateWorkflowUseCase().execute({ metadata: { name: "Flow" }, validateOnCreate: true, nodes: [makeNode({ id: "n1" })] });
    expect(result.workflow.validate().isValid).toBeTrue();
  });
});

