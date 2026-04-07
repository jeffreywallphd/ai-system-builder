import { describe, expect, it } from "bun:test";
import type { INodeExecutor } from "../interfaces/INodeExecutor";

describe("INodeExecutor contract", () => {
  it("can execute a node from context", async () => {
    const executor: INodeExecutor = {
      canExecuteNode: () => true,
      executeNode: async () => ({ nodeId: "n1", status: "completed", outputs: { ok: true } }),
    };

    expect(executor.canExecuteNode({} as never)).toBeTrue();
    const result = await executor.executeNode({} as never);
    expect(result.outputs).toEqual({ ok: true });
  });
});
