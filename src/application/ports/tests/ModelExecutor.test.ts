import { describe, expect, it } from "bun:test";
import type { IModelExecutor } from "../interfaces/IModelExecutor";

describe("IModelExecutor contract", () => {
  it("supports runtime/canExecute/execute members", () => {
    const executor: IModelExecutor = {
      runtime: "test",
      canExecute: () => true,
      execute: async () => ({ status: "completed", outputs: {} }),
    };

    expect(executor.runtime).toBe("test");
    expect(executor.canExecute({ node: { id: "n1" } as never, inputs: {} })).toBeTrue();
  });
});
