import { describe, expect, it } from "bun:test";
import { makeNode } from "../../../../src/domain/workflows/tests/testUtils";
import { ComfyNodeAdapter } from "../ComfyNodeAdapter";

describe("ComfyNodeAdapter", () => {
  it("adapts node and resolves port mappings", () => {
    const node = makeNode({ id: "n1", inputPortId: "in_a", outputPortId: "out_a" });
    const adapter = new ComfyNodeAdapter();

    const dto = adapter.adaptNode(node);
    expect(dto.class_type).toBe("test");
    expect(adapter.getInputName(node, "in_a")).toBe("in_a");
    expect(adapter.getOutputPortIndex(node, "out_a")).toBe(0);
  });
});
