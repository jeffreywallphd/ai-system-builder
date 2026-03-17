import { describe, expect, it } from "bun:test";
import type { INodeOutputStore } from "../interfaces/INodeOutputStore";

class TestStore implements INodeOutputStore {
  private readonly map = new Map<string, Readonly<Record<string, unknown>>>();
  setNodeOutput(nodeId: string, output: Readonly<Record<string, unknown>>): void { this.map.set(nodeId, output); }
  getNodeOutput(nodeId: string): Readonly<Record<string, unknown>> | undefined { return this.map.get(nodeId); }
  hasNodeOutput(nodeId: string): boolean { return this.map.has(nodeId); }
  snapshot(): Readonly<Record<string, Readonly<Record<string, unknown>>>> { return Object.fromEntries(this.map.entries()); }
  clear(): void { this.map.clear(); }
}

describe("INodeOutputStore contract", () => {
  it("stores and returns node outputs", () => {
    const store = new TestStore();
    store.setNodeOutput("n1", { value: 1 });
    expect(store.hasNodeOutput("n1")).toBeTrue();
    expect(store.getNodeOutput("n1")).toEqual({ value: 1 });
  });
});
