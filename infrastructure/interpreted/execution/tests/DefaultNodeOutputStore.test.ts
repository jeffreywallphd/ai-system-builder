import { describe, expect, it } from "bun:test";
import { DefaultNodeOutputStore } from "../DefaultNodeOutputStore";

describe("DefaultNodeOutputStore", () => {
  it("stores outputs by node id", () => {
    const store = new DefaultNodeOutputStore();
    store.setNodeOutput("n1", { value: 3 });
    expect(store.getNodeOutput("n1")).toEqual({ value: 3 });
    expect(store.hasNodeOutput("n1")).toBeTrue();
  });
});
