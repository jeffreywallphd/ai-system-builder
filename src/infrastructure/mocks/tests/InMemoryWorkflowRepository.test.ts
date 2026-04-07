import { describe, expect, it } from "bun:test";
import { CreateWorkflowUseCase } from "@application/workflows/CreateWorkflowUseCase";
import { InMemoryWorkflowRepository } from "../repositories/InMemoryWorkflowRepository";

describe("InMemoryWorkflowRepository", () => {
  it("saves, loads, lists, and deletes workflows", async () => {
    const useCase = new CreateWorkflowUseCase();
    const workflow = useCase.execute({ metadata: { name: "Draft" } }).workflow;
    const repository = new InMemoryWorkflowRepository();

    await repository.save(workflow);

    expect((await repository.load(` ${workflow.id} `))?.id).toBe(workflow.id);
    expect(await repository.list()).toHaveLength(1);
    expect(await repository.delete(` ${workflow.id} `)).toBe(true);
    expect(await repository.load(workflow.id)).toBeUndefined();
  });
});

