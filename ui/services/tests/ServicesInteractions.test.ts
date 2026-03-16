import { describe, expect, it } from "bun:test";
import { WorkflowService } from "../WorkflowService";

describe("ui/services interactions", () => {
  it("updates workflow metadata through rename and description helpers", () => {
    const workflow = {
      id: "w1",
      metadata: { name: "Old" },
      withMetadata(metadata: any) {
        return { ...this, metadata };
      },
      withEnabled() {
        return this;
      },
      getNode() {
        return undefined;
      },
      updateNode() {
        return this;
      },
    } as any;

    const service = new WorkflowService({
      createWorkflowUseCase: { execute: async () => ({}) } as any,
      executeWorkflowUseCase: { execute: async () => ({}) } as any,
      validateWorkflowUseCase: { execute: () => ({ validation: { isValid: true } }) } as any,
      workflowRepository: {
        save: async () => undefined,
        load: async () => undefined,
        list: async () => [],
        delete: async () => true,
      },
    });

    const renamed = service.renameWorkflow(workflow, "  New Name  ");
    const described = service.setWorkflowDescription(renamed, "  Hello  ");

    expect(described.metadata.name).toBe("New Name");
    expect(described.metadata.description).toBe("Hello");
  });
});
