import { describe, expect, it } from "bun:test";
import { NodeProperty } from "../../../../domain/nodes/NodeProperty";
import { ComfyPropertyAdapter } from "../ComfyPropertyAdapter";

describe("ComfyPropertyAdapter", () => {
  it("adapts persisted properties", () => {
    const adapter = new ComfyPropertyAdapter();
    const property = new NodeProperty({ id: "steps", name: "Steps", type: "integer", value: 12.7, isPersisted: true });
    const adapted = adapter.adaptProperty(property);
    expect(adapted?.name).toBe("steps");
    expect(adapted?.value).toBe(12);
  });
});
