import { describe, expect, it } from "bun:test";
import { UpdateNodePropertyUseCase } from "../UpdateNodePropertyUseCase";
import { makeNode, makeWorkflow } from "../../../domain/services/tests/testUtils";

describe("UpdateNodePropertyUseCase", () => {
  it("updates property value and returns updated workflow", () => {
    const node = makeNode({ id: "n1" });
    const workflow = makeWorkflow({ nodes: [node] });

    const result = new UpdateNodePropertyUseCase().execute({
      workflow,
      nodeId: "n1",
      propertyId: "required",
      value: "changed",
    });

    expect(result.property.value).toBe("changed");
    expect(result.workflow.getNode("n1")?.getProperty("required")?.value).toBe("changed");
  });

  it("throws for unknown properties", () => {
    const workflow = makeWorkflow({ nodes: [makeNode({ id: "n1" })] });
    expect(() => new UpdateNodePropertyUseCase().execute({ workflow, nodeId: "n1", propertyId: "missing", value: 1 })).toThrow("does not contain property");
  });
});
