import { describe, expect, it } from "bun:test";
import { ComfyModelExecutor } from "../ComfyModelExecutor";

describe("ComfyModelExecutor", () => {
  it("returns delegated execution payload for comfy runtime", async () => {
    const executor = new ComfyModelExecutor();
    const result = await executor.execute({ node: { id: "n1" } as never, runtime: "comfyui", inputs: {} });

    expect(result.status).toBe("completed");
    expect(result.outputs.delegated).toBeTrue();
  });
});
